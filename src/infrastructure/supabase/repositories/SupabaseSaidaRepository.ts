import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Saida, SaidaPayload, SaidaResumo } from '../../../domain/entities/Saida'
import type { SaidaFiltro, SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID, Paginated, Periodo } from '../../../shared/types/common'
import { faixaDaPagina, montarPaginado } from '../../../shared/utils/paginacao'
import { limitesDoMes, mesAnterior } from '../../../shared/utils/periodo'
import { chaveDaSerieDoItem, projetarRecorrencias } from '../../../shared/utils/recorrencia'
import type { Database } from '../database.types'

type SaidaRow = Database['public']['Tables']['saidas']['Row']

function paraSaida(row: SaidaRow): Saida {
  return {
    id: row.id,
    descricao: row.descricao,
    valor: Number(row.valor),
    data: row.data,
    categoriaId: row.categoria_id,
    status: row.status as Saida['status'],
    formaPagamento: row.forma_pagamento as Saida['formaPagamento'],
    cartaoId: row.cartao_id,
    recorrente: row.recorrente,
    observacao: row.observacao,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    automatica: row.automatica,
  }
}

function paraLinha(payload: SaidaPayload) {
  return {
    descricao: payload.descricao,
    valor: payload.valor,
    data: payload.data,
    categoria_id: payload.categoriaId,
    status: payload.status,
    forma_pagamento: payload.formaPagamento,
    cartao_id: payload.cartaoId ?? null,
    recorrente: payload.recorrente,
    observacao: payload.observacao ?? null,
  }
}

/**
 * Recebe um client Supabase escopado no JWT do usuário — o RLS já restringe as
 * queries ao próprio usuário; o filtro explícito por userId é defesa em profundidade.
 */
export class SupabaseSaidaRepository implements SaidaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Saídas reais do período + projeção das séries recorrentes que ainda não têm
   * ocorrência própria nesse mês (ver `projetarRecorrencias`). Busca todas as linhas
   * do período (sem filtro de categoria/status/busca) porque a projeção precisa
   * saber, sem ambiguidade, quais séries já foram lançadas de fato — o filtro do
   * chamador é aplicado depois, sobre o conjunto já combinado.
   */
  private async comProjecao(userId: ID, periodo: Periodo): Promise<Saida[]> {
    const { inicio, fim } = limitesDoMes(periodo)

    const [doPeriodo, candidatas] = await Promise.all([
      this.supabase.from('saidas').select('*').eq('user_id', userId).gte('data', inicio).lte('data', fim),
      this.supabase.from('saidas').select('*').eq('user_id', userId).eq('recorrente', true).lt('data', inicio),
    ])

    if (doPeriodo.error) throw doPeriodo.error
    if (candidatas.error) throw candidatas.error

    const reais = doPeriodo.data.map(paraSaida)
    const chavesRealizadas = new Set(reais.map(chaveDaSerieDoItem))
    const projetadas = projetarRecorrencias(candidatas.data.map(paraSaida), chavesRealizadas, periodo)

    return [...reais, ...projetadas].sort((a, b) => b.data.localeCompare(a.data))
  }

  async listar(userId: ID, filtro: SaidaFiltro): Promise<Paginated<Saida>> {
    const todas = await this.comProjecao(userId, filtro.periodo)
    const busca = filtro.busca?.toLocaleLowerCase()

    const filtradas = todas
      .filter((saida) => !filtro.categoriaId || saida.categoriaId === filtro.categoriaId)
      .filter((saida) => !filtro.status || saida.status === filtro.status)
      .filter(
        (saida) =>
          !busca ||
          saida.descricao.toLocaleLowerCase().includes(busca) ||
          (saida.observacao ?? '').toLocaleLowerCase().includes(busca),
      )

    const [de, ate] = faixaDaPagina(filtro.page, filtro.pageSize)
    return montarPaginado(filtradas.slice(de, ate + 1), filtro.page, filtro.pageSize, filtradas.length)
  }

  async resumo(userId: ID, periodo: Periodo): Promise<SaidaResumo> {
    const [doPeriodo, doMesAnterior, categorias] = await Promise.all([
      this.comProjecao(userId, periodo),
      this.comProjecao(userId, mesAnterior(periodo)),
      this.supabase.from('categorias').select('id, nome, cor'),
    ])

    if (categorias.error) throw categorias.error

    const categoriaPorId = new Map(categorias.data.map((categoria) => [categoria.id, categoria]))
    const total = doPeriodo.reduce((soma, saida) => soma + saida.valor, 0)
    const totalPago = doPeriodo.filter((saida) => saida.status === 'PAGO').reduce((soma, saida) => soma + saida.valor, 0)
    const totalPendente = total - totalPago
    const totalMesAnterior = doMesAnterior.reduce((soma, saida) => soma + saida.valor, 0)

    const agrupado = new Map<string, number>()
    for (const saida of doPeriodo) {
      agrupado.set(saida.categoriaId, (agrupado.get(saida.categoriaId) ?? 0) + saida.valor)
    }

    const porCategoria = [...agrupado.entries()]
      .map(([categoriaId, valor]) => {
        const categoria = categoriaPorId.get(categoriaId)
        return {
          categoriaId,
          nome: categoria?.nome ?? 'Sem categoria',
          cor: categoria?.cor ?? '#94a3b8',
          total: valor,
        }
      })
      .sort((a, b) => b.total - a.total)

    return {
      total,
      quantidade: doPeriodo.length,
      media: doPeriodo.length ? total / doPeriodo.length : 0,
      totalPago,
      totalPendente,
      totalMesAnterior,
      porCategoria,
    }
  }

  async buscarPorId(userId: ID, id: ID): Promise<Saida | null> {
    const { data, error } = await this.supabase
      .from('saidas')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? paraSaida(data) : null
  }

  async criar(userId: ID, payload: SaidaPayload): Promise<Saida> {
    const { data, error } = await this.supabase
      .from('saidas')
      .insert({ ...paraLinha(payload), user_id: userId })
      .select('*')
      .single()

    if (error) throw error
    return paraSaida(data)
  }

  async atualizar(userId: ID, id: ID, payload: SaidaPayload): Promise<Saida> {
    const { data, error } = await this.supabase
      .from('saidas')
      .update(paraLinha(payload))
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Saída')
    return paraSaida(data)
  }

  async remover(userId: ID, id: ID): Promise<void> {
    const { data, error } = await this.supabase
      .from('saidas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Saída')
  }
}
