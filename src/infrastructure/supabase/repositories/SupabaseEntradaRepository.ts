import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Entrada, EntradaPayload, EntradaResumo } from '../../../domain/entities/Entrada'
import type { EntradaFiltro, EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID, Paginated, Periodo } from '../../../shared/types/common'
import { faixaDaPagina, montarPaginado } from '../../../shared/utils/paginacao'
import { limitesDoMes, mesAnterior } from '../../../shared/utils/periodo'
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

  async listar(userId: ID, filtro: EntradaFiltro): Promise<Paginated<Entrada>> {
    const { inicio, fim } = limitesDoMes(filtro.periodo)
    const [de, ate] = faixaDaPagina(filtro.page, filtro.pageSize)

    let query = this.supabase
      .from('entradas')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false })
      .range(de, ate)

    if (filtro.categoriaId) query = query.eq('categoria_id', filtro.categoriaId)
    if (filtro.busca) query = query.or(`descricao.ilike.%${filtro.busca}%,observacao.ilike.%${filtro.busca}%`)

    const { data, count, error } = await query
    if (error) throw error

    return montarPaginado(data.map(paraEntrada), filtro.page, filtro.pageSize, count ?? 0)
  }

  async resumo(userId: ID, periodo: Periodo): Promise<EntradaResumo> {
    const { inicio, fim } = limitesDoMes(periodo)
    const anterior = limitesDoMes(mesAnterior(periodo))

    const [doPeriodo, doMesAnterior, categorias] = await Promise.all([
      this.supabase.from('entradas').select('valor, categoria_id').eq('user_id', userId).gte('data', inicio).lte('data', fim),
      this.supabase
        .from('entradas')
        .select('valor')
        .eq('user_id', userId)
        .gte('data', anterior.inicio)
        .lte('data', anterior.fim),
      this.supabase.from('categorias').select('id, nome, cor'),
    ])

    if (doPeriodo.error) throw doPeriodo.error
    if (doMesAnterior.error) throw doMesAnterior.error
    if (categorias.error) throw categorias.error

    const categoriaPorId = new Map(categorias.data.map((categoria) => [categoria.id, categoria]))
    const total = doPeriodo.data.reduce((soma, linha) => soma + Number(linha.valor), 0)
    const totalMesAnterior = doMesAnterior.data.reduce((soma, linha) => soma + Number(linha.valor), 0)

    const agrupado = new Map<string, number>()
    for (const linha of doPeriodo.data) {
      agrupado.set(linha.categoria_id, (agrupado.get(linha.categoria_id) ?? 0) + Number(linha.valor))
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
      quantidade: doPeriodo.data.length,
      media: doPeriodo.data.length ? total / doPeriodo.data.length : 0,
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
