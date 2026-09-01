import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Entrada, EntradaPayload, EntradaResumo } from '../../../domain/entities/Entrada'
import type { EntradaFiltro, EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID, Paginated, Periodo } from '../../../shared/types/common'
import { faixaDaPagina, montarPaginado } from '../../../shared/utils/paginacao'
import { limitesDoMes, mesAnterior } from '../../../shared/utils/periodo'
import { chaveDaSerieDoItem, projetarRecorrencias } from '../../../shared/utils/recorrencia'
import type { Database } from '../database.types'

type EntradaRow = Database['public']['Tables']['entradas']['Row']

function paraEntrada(row: EntradaRow): Entrada {
  return {
    id: row.id,
    descricao: row.descricao,
    valor: Number(row.valor),
    data: row.data,
    categoriaId: row.categoria_id,
    recorrente: row.recorrente,
    observacao: row.observacao,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  }
}

function paraLinha(payload: EntradaPayload) {
  return {
    descricao: payload.descricao,
    valor: payload.valor,
    data: payload.data,
    categoria_id: payload.categoriaId,
    recorrente: payload.recorrente,
    observacao: payload.observacao ?? null,
  }
}

/**
 * Recebe um client Supabase escopado no JWT do usuário — o RLS já restringe as
 * queries ao próprio usuário; o filtro explícito por userId é defesa em profundidade.
 */
export class SupabaseEntradaRepository implements EntradaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Entradas reais do período + projeção das séries recorrentes que ainda não têm
   * ocorrência própria nesse mês (ver `projetarRecorrencias`). Busca todas as linhas
   * do período (sem filtro de categoria/busca) porque a projeção precisa saber, sem
   * ambiguidade, quais séries já foram lançadas de fato — o filtro do chamador é
   * aplicado depois, sobre o conjunto já combinado.
   */
  private async comProjecao(userId: ID, periodo: Periodo): Promise<Entrada[]> {
    const { inicio, fim } = limitesDoMes(periodo)

    const [doPeriodo, candidatas] = await Promise.all([
      this.supabase.from('entradas').select('*').eq('user_id', userId).gte('data', inicio).lte('data', fim),
      this.supabase.from('entradas').select('*').eq('user_id', userId).eq('recorrente', true).lt('data', inicio),
    ])

    if (doPeriodo.error) throw doPeriodo.error
    if (candidatas.error) throw candidatas.error

    const reais = doPeriodo.data.map(paraEntrada)
    const chavesRealizadas = new Set(reais.map(chaveDaSerieDoItem))
    const projetadas = projetarRecorrencias(candidatas.data.map(paraEntrada), chavesRealizadas, periodo)

    return [...reais, ...projetadas].sort((a, b) => b.data.localeCompare(a.data))
  }

  async listar(userId: ID, filtro: EntradaFiltro): Promise<Paginated<Entrada>> {
    const todas = await this.comProjecao(userId, filtro.periodo)
    const busca = filtro.busca?.toLocaleLowerCase()

    const filtradas = todas
      .filter((entrada) => !filtro.categoriaId || entrada.categoriaId === filtro.categoriaId)
      .filter(
        (entrada) =>
          !busca ||
          entrada.descricao.toLocaleLowerCase().includes(busca) ||
          (entrada.observacao ?? '').toLocaleLowerCase().includes(busca),
      )

    const [de, ate] = faixaDaPagina(filtro.page, filtro.pageSize)
    return montarPaginado(filtradas.slice(de, ate + 1), filtro.page, filtro.pageSize, filtradas.length)
  }

  async resumo(userId: ID, periodo: Periodo): Promise<EntradaResumo> {
    const [doPeriodo, doMesAnterior, categorias] = await Promise.all([
      this.comProjecao(userId, periodo),
      this.comProjecao(userId, mesAnterior(periodo)),
      this.supabase.from('categorias').select('id, nome, cor'),
    ])

    if (categorias.error) throw categorias.error

    const categoriaPorId = new Map(categorias.data.map((categoria) => [categoria.id, categoria]))
    const total = doPeriodo.reduce((soma, entrada) => soma + entrada.valor, 0)
    const totalMesAnterior = doMesAnterior.reduce((soma, entrada) => soma + entrada.valor, 0)

    const agrupado = new Map<string, number>()
    for (const entrada of doPeriodo) {
      agrupado.set(entrada.categoriaId, (agrupado.get(entrada.categoriaId) ?? 0) + entrada.valor)
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
      totalMesAnterior,
      porCategoria,
    }
  }

  async criar(userId: ID, payload: EntradaPayload): Promise<Entrada> {
    const { data, error } = await this.supabase
      .from('entradas')
      .insert({ ...paraLinha(payload), user_id: userId })
      .select('*')
      .single()

    if (error) throw error
    return paraEntrada(data)
  }

  async atualizar(userId: ID, id: ID, payload: EntradaPayload): Promise<Entrada> {
    const { data, error } = await this.supabase
      .from('entradas')
      .update(paraLinha(payload))
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Entrada')
    return paraEntrada(data)
  }

  async remover(userId: ID, id: ID): Promise<void> {
    const { data, error } = await this.supabase
      .from('entradas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Entrada')
  }
}
