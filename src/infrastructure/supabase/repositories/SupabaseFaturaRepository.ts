import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Cartao } from '../../../domain/entities/Cartao'
import type {
  CartaoComFatura,
  Fatura,
  FaturaDetalhada,
  FaturaFiltro,
  TransacaoCartao,
  TransacaoCartaoPayload,
} from '../../../domain/entities/Fatura'
import type { DatasDaFatura, FaturaComoSaida, FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID, Periodo } from '../../../shared/types/common'
import { calcularDatasFatura } from '../../../shared/utils/fatura'
import { limitesDoMes, paraPeriodo } from '../../../shared/utils/periodo'
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
    tipo: row.tipo as TransacaoCartao['tipo'],
    parcelaAtual: row.parcela_atual,
    totalParcelas: row.total_parcelas,
    recorrente: row.recorrente,
    observacao: row.observacao,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

function paraLinha(payload: TransacaoCartaoPayload) {
  return {
    descricao: payload.descricao,
    valor: payload.valor,
    data: payload.data,
    categoria_id: payload.categoriaId,
    tipo: payload.tipo,
    parcela_atual: payload.parcelaAtual,
    total_parcelas: payload.totalParcelas,
    recorrente: payload.recorrente,
    observacao: payload.observacao ?? null,
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

  /**
   * Faturas com vencimento dentro do período, com o mesmo total exibido na aba
   * Cartões: o total real gravado somado às recorrências ainda não lançadas na
   * competência (ver `projetarRecorrencias`). Faturas zeradas ficam de fora — sem
   * débito não há saída a mostrar.
   */
  async listarVencendoNoPeriodo(userId: ID, periodo: Periodo): Promise<FaturaComoSaida[]> {
    const { inicio, fim } = limitesDoMes(periodo)

    const { data: faturas, error: erroFaturas } = await this.supabase
      .from('faturas')
      .select('*')
      .eq('user_id', userId)
      .gte('vencimento', inicio)
      .lte('vencimento', fim)
    if (erroFaturas) throw erroFaturas
    if (faturas.length === 0) return []

    const cartaoIds = [...new Set(faturas.map((fatura) => fatura.cartao_id))]
    const inicioMaisAntigo = faturas
      .map((fatura) => limitesDoMes(paraPeriodo(fatura.competencia)).inicio)
      .sort()[0]!

    const [cartoesRes, transacoesRes, candidatasRes, categoriaRes] = await Promise.all([
      this.supabase.from('cartoes').select('id, nome').eq('user_id', userId).in('id', cartaoIds),
      this.supabase
        .from('transacoes_cartao')
        .select('*')
        .eq('user_id', userId)
        .in(
          'fatura_id',
          faturas.map((fatura) => fatura.id),
        ),
      this.supabase
        .from('transacoes_cartao')
        .select('*')
        .eq('user_id', userId)
        .eq('recorrente', true)
        .in('cartao_id', cartaoIds)
        .lt('data', inicioMaisAntigo),
      // Categoria em que a fatura entra na aba Saídas — espelha o mock do frontend
      // (`faturasComoSaidas` em services/mock/db.ts), que usa "Despesa Variável".
      this.supabase
        .from('categorias')
        .select('id')
        .eq('movimento', 'SAIDA')
        .eq('tipo', 'CONTA_VARIAVEL')
        .order('criado_em', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])
    if (cartoesRes.error) throw cartoesRes.error
    if (transacoesRes.error) throw transacoesRes.error
    if (candidatasRes.error) throw candidatasRes.error
    if (categoriaRes.error) throw categoriaRes.error

    const nomePorCartao = new Map(cartoesRes.data.map((cartao) => [cartao.id, cartao.nome]))
    const candidatasPorCartao = new Map<ID, TransacaoCartao[]>()
    for (const row of candidatasRes.data) {
      const transacao = paraTransacao(row)
      const lista = candidatasPorCartao.get(transacao.cartaoId) ?? []
      lista.push(transacao)
      candidatasPorCartao.set(transacao.cartaoId, lista)
    }

    return faturas
      .map((fatura) => {
        const chavesRealizadas = new Set(
          transacoesRes.data.filter((t) => t.fatura_id === fatura.id).map(paraTransacao).map(chaveDaSerieDoItem),
        )
        const projetadas = projetarRecorrencias(
          candidatasPorCartao.get(fatura.cartao_id) ?? [],
          chavesRealizadas,
          paraPeriodo(fatura.competencia),
        )

        return {
          faturaId: fatura.id,
          cartaoId: fatura.cartao_id,
          cartaoNome: nomePorCartao.get(fatura.cartao_id) ?? 'Cartão',
          categoriaId: categoriaRes.data?.id ?? '',
          vencimento: fatura.vencimento,
          total: Number(fatura.total) + projetadas.reduce((soma, transacao) => soma + transacao.valor, 0),
          paga: fatura.status === 'PAGA',
        }
      })
      .filter((fatura) => fatura.total > 0)
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

  async buscarTransacaoPorId(userId: ID, id: ID): Promise<TransacaoCartao | null> {
    const { data, error } = await this.supabase
      .from('transacoes_cartao')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? paraTransacao(data) : null
  }

  async criarTransacao(
    userId: ID,
    cartaoId: ID,
    payload: TransacaoCartaoPayload,
    datas: DatasDaFatura,
  ): Promise<TransacaoCartao> {
    const fatura = await this.garantirFatura(userId, cartaoId, datas)

    const { data, error } = await this.supabase
      .from('transacoes_cartao')
      .insert({ ...paraLinha(payload), fatura_id: fatura.id, cartao_id: cartaoId, user_id: userId })
      .select('*')
      .single()
    if (error) throw error

    await this.recalcularTotal(fatura.id)
    return paraTransacao(data)
  }

  async atualizarTransacao(
    userId: ID,
    id: ID,
    payload: TransacaoCartaoPayload,
    datas: DatasDaFatura,
  ): Promise<TransacaoCartao> {
    const atual = await this.buscarTransacaoPorId(userId, id)
    if (!atual) throw new NotFoundError('Transação do cartão')

    const fatura = await this.garantirFatura(userId, atual.cartaoId, datas)

    const { data, error } = await this.supabase
      .from('transacoes_cartao')
      .update({ ...paraLinha(payload), fatura_id: fatura.id })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundError('Transação do cartão')

    // Mudar a data pode trocar a competência: as duas faturas envolvidas precisam ser somadas de novo.
    await this.recalcularTotal(atual.faturaId)
    if (fatura.id !== atual.faturaId) await this.recalcularTotal(fatura.id)

    return paraTransacao(data)
  }

  async removerTransacao(userId: ID, id: ID): Promise<void> {
    const { data, error } = await this.supabase
      .from('transacoes_cartao')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('fatura_id')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Transação do cartão')

    await this.recalcularTotal(data.fatura_id)
  }

  /** Fatura da competência, criada como ABERTA na primeira transação do mês. */
  private async garantirFatura(userId: ID, cartaoId: ID, datas: DatasDaFatura): Promise<FaturaRow> {
    const { data: existente, error: erroBusca } = await this.supabase
      .from('faturas')
      .select('*')
      .eq('cartao_id', cartaoId)
      .eq('competencia', datas.competencia)
      .eq('user_id', userId)
      .maybeSingle()
    if (erroBusca) throw erroBusca
    if (existente) return existente

    const { data, error } = await this.supabase
      .from('faturas')
      .insert({
        cartao_id: cartaoId,
        user_id: userId,
        competencia: datas.competencia,
        fechamento: datas.fechamento,
        vencimento: datas.vencimento,
        total: 0,
        status: 'ABERTA',
      })
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  /** O total da fatura é sempre a soma das transações — evita saldo torto por delta perdido. */
  private async recalcularTotal(faturaId: ID): Promise<void> {
    const { data, error } = await this.supabase.from('transacoes_cartao').select('valor').eq('fatura_id', faturaId)
    if (error) throw error

    const total = data.reduce((soma, linha) => soma + Number(linha.valor), 0)
    const { error: erroTotal } = await this.supabase.from('faturas').update({ total }).eq('id', faturaId)
    if (erroTotal) throw erroTotal
  }
}
