import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Cartao } from '../../../domain/entities/Cartao'
import type {
  CartaoComFatura,
  Fatura,
  FaturaDetalhada,
  FaturaFiltro,
  TransacaoCartao,
} from '../../../domain/entities/Fatura'
import type { FaturaRepository, RegistrarTransacaoParams } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'
import { calcularDatasFatura } from '../../../shared/utils/fatura'
import { limitesDoMes } from '../../../shared/utils/periodo'
import { chaveDaSerieDoItem, projetarRecorrencias } from '../../../shared/utils/recorrencia'
import type { Database } from '../database.types'

type CartaoRow = Database['public']['Tables']['cartoes']['Row']
type FaturaRow = Database['public']['Tables']['faturas']['Row']
type TransacaoRow = Database['public']['Tables']['transacoes_cartao']['Row']

function paraCartao(row: CartaoRow): Cartao {
  return {
    id: row.id,
    nome: row.nome,
    bandeira: row.bandeira as Cartao['bandeira'],
    ultimosDigitos: row.ultimos_digitos,
    limite: Number(row.limite),
    diaFechamento: row.dia_fechamento,
    diaVencimento: row.dia_vencimento,
    cor: row.cor,
    ativo: row.ativo,
    criadoEm: row.criado_em,
  }
}

function paraFatura(row: FaturaRow): Fatura {
  return {
    id: row.id,
    cartaoId: row.cartao_id,
    competencia: row.competencia,
    fechamento: row.fechamento,
    vencimento: row.vencimento,
    total: Number(row.total),
    status: row.status as Fatura['status'],
    pagoEm: row.pago_em,
  }
}

function paraTransacao(row: TransacaoRow): TransacaoCartao {
  return {
    id: row.id,
    cartaoId: row.cartao_id,
    faturaId: row.fatura_id,
    descricao: row.descricao,
    valor: Number(row.valor),
    data: row.data,
    categoriaId: row.categoria_id,
    parcelaAtual: row.parcela_atual,
    totalParcelas: row.total_parcelas,
    recorrente: row.recorrente,
  }
}

export class SupabaseFaturaRepository implements FaturaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listarComFaturas(userId: ID, filtro: FaturaFiltro): Promise<CartaoComFatura[]> {
    const competencia = `${filtro.periodo.ano}-${String(filtro.periodo.mes).padStart(2, '0')}`
    const { inicio } = limitesDoMes(filtro.periodo)

    let cartoesQuery = this.supabase
      .from('cartoes')
      .select('*')
      .eq('user_id', userId)
      .order('ativo', { ascending: false })
      .order('nome', { ascending: true })

    if (filtro.cartaoId) cartoesQuery = cartoesQuery.eq('id', filtro.cartaoId)

    const { data: cartoes, error: erroCartoes } = await cartoesQuery
    if (erroCartoes) throw erroCartoes
    if (cartoes.length === 0) return []

    const cartaoIds = cartoes.map((cartao) => cartao.id)

    const [{ data: faturas, error: erroFaturas }, { data: candidatasRows, error: erroCandidatas }] = await Promise.all([
      this.supabase.from('faturas').select('*').eq('user_id', userId).eq('competencia', competencia).in('cartao_id', cartaoIds),
      this.supabase
        .from('transacoes_cartao')
        .select('*')
        .eq('user_id', userId)
        .eq('recorrente', true)
        .in('cartao_id', cartaoIds)
        .lt('data', inicio),
    ])
    if (erroFaturas) throw erroFaturas
    if (erroCandidatas) throw erroCandidatas

    const faturaIds = faturas.map((fatura) => fatura.id)
    const { data: transacoes, error: erroTransacoes } =
      faturaIds.length > 0
        ? await this.supabase.from('transacoes_cartao').select('*').in('fatura_id', faturaIds).order('data', { ascending: false })
        : { data: [] as TransacaoRow[], error: null }
    if (erroTransacoes) throw erroTransacoes

    const candidatasPorCartao = new Map<ID, TransacaoCartao[]>()
    for (const row of candidatasRows) {
      const transacao = paraTransacao(row)
      const lista = candidatasPorCartao.get(transacao.cartaoId) ?? []
      lista.push(transacao)
      candidatasPorCartao.set(transacao.cartaoId, lista)
    }

    return cartoes.map((cartaoRow) => {
      const cartao = paraCartao(cartaoRow)
      const faturaRow = faturas.find((fatura) => fatura.cartao_id === cartao.id)
      const transacoesReais = faturaRow ? transacoes.filter((t) => t.fatura_id === faturaRow.id).map(paraTransacao) : []

      // Transações recorrentes anteriores ao mês que ainda não têm ocorrência
      // própria nesta competência (ver `projetarRecorrencias`) — nunca persistidas.
      const chavesRealizadas = new Set(transacoesReais.map(chaveDaSerieDoItem))
      const projetadas = projetarRecorrencias(candidatasPorCartao.get(cartao.id) ?? [], chavesRealizadas, filtro.periodo)

      if (!faturaRow && projetadas.length === 0) {
        return { cartao, fatura: null, usoLimite: 0 }
      }

      const totalProjetado = projetadas.reduce((soma, transacao) => soma + transacao.valor, 0)

      // Sem fatura real ainda: sintetiza uma fatura virtual (nunca persistida) só
      // pra carregar as transações projetadas, com fechamento/vencimento calculados
      // como se a fatura real fosse aberta agora.
      const idFaturaAlvo = faturaRow ? faturaRow.id : `fat_virtual_${cartao.id}_${competencia}`
      const transacoesFinal = [...transacoesReais, ...projetadas].map((transacao) => ({
        ...transacao,
        faturaId: idFaturaAlvo,
      }))

      const fatura: FaturaDetalhada = faturaRow
        ? { ...paraFatura(faturaRow), total: Number(faturaRow.total) + totalProjetado, transacoes: transacoesFinal }
        : {
            id: idFaturaAlvo,
            cartaoId: cartao.id,
            competencia,
            ...calcularDatasFatura(cartao, competencia),
            total: totalProjetado,
            status: 'ABERTA',
            pagoEm: null,
            transacoes: transacoesFinal,
          }

      const usoLimite = cartao.limite > 0 ? (fatura.total / cartao.limite) * 100 : 0

      return { cartao, fatura, usoLimite }
    })
  }

  async pagar(userId: ID, faturaId: ID): Promise<void> {
    const { data, error } = await this.supabase
      .from('faturas')
      .update({ status: 'PAGA', pago_em: new Date().toISOString().slice(0, 10) })
      .eq('id', faturaId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Fatura')
  }

  async registrarTransacao(userId: ID, params: RegistrarTransacaoParams): Promise<void> {
    const { data: faturaExistente, error: erroBusca } = await this.supabase
      .from('faturas')
      .select('*')
      .eq('cartao_id', params.cartaoId)
      .eq('competencia', params.competencia)
      .eq('user_id', userId)
      .maybeSingle()
    if (erroBusca) throw erroBusca

    const fatura =
      faturaExistente ??
      (await (async () => {
        const { data, error } = await this.supabase
          .from('faturas')
          .insert({
            cartao_id: params.cartaoId,
            user_id: userId,
            competencia: params.competencia,
            fechamento: params.fechamento,
            vencimento: params.vencimento,
            total: 0,
            status: 'ABERTA',
          })
          .select('*')
          .single()
        if (error) throw error
        return data
      })())

    const { error: erroTransacao } = await this.supabase.from('transacoes_cartao').insert({
      fatura_id: fatura.id,
      cartao_id: params.cartaoId,
      user_id: userId,
      categoria_id: params.categoriaId,
      descricao: params.descricao,
      valor: params.valor,
      data: params.data,
      parcela_atual: params.parcelaAtual,
      total_parcelas: params.totalParcelas,
      recorrente: params.recorrente,
    })
    if (erroTransacao) throw erroTransacao

    const { error: erroAtualizarTotal } = await this.supabase
      .from('faturas')
      .update({ total: Number(fatura.total) + params.valor })
      .eq('id', fatura.id)
    if (erroAtualizarTotal) throw erroAtualizarTotal
  }
}
