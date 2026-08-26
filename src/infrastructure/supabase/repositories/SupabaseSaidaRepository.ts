import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Saida, SaidaPayload, SaidaResumo } from '../../../domain/entities/Saida'
import type { SaidaFiltro, SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID, Paginated, Periodo } from '../../../shared/types/common'
import { faixaDaPagina, montarPaginado } from '../../../shared/utils/paginacao'
import { limitesDoMes, mesAnterior } from '../../../shared/utils/periodo'
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

  async listar(userId: ID, filtro: SaidaFiltro): Promise<Paginated<Saida>> {
    const { inicio, fim } = limitesDoMes(filtro.periodo)
    const [de, ate] = faixaDaPagina(filtro.page, filtro.pageSize)

    let query = this.supabase
      .from('saidas')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false })
      .range(de, ate)

    if (filtro.categoriaId) query = query.eq('categoria_id', filtro.categoriaId)
    if (filtro.status) query = query.eq('status', filtro.status)
    if (filtro.busca) query = query.or(`descricao.ilike.%${filtro.busca}%,observacao.ilike.%${filtro.busca}%`)

    const { data, count, error } = await query
    if (error) throw error

    return montarPaginado(data.map(paraSaida), filtro.page, filtro.pageSize, count ?? 0)
  }

  async resumo(userId: ID, periodo: Periodo): Promise<SaidaResumo> {
    const { inicio, fim } = limitesDoMes(periodo)
    const anterior = limitesDoMes(mesAnterior(periodo))

    const [doPeriodo, doMesAnterior, categorias] = await Promise.all([
      this.supabase
        .from('saidas')
        .select('valor, categoria_id, status')
        .eq('user_id', userId)
        .gte('data', inicio)
        .lte('data', fim),
      this.supabase.from('saidas').select('valor').eq('user_id', userId).gte('data', anterior.inicio).lte('data', anterior.fim),
      this.supabase.from('categorias').select('id, nome, cor'),
    ])

    if (doPeriodo.error) throw doPeriodo.error
    if (doMesAnterior.error) throw doMesAnterior.error
    if (categorias.error) throw categorias.error

    const categoriaPorId = new Map(categorias.data.map((categoria) => [categoria.id, categoria]))
    const total = doPeriodo.data.reduce((soma, linha) => soma + Number(linha.valor), 0)
    const totalPago = doPeriodo.data
      .filter((linha) => linha.status === 'PAGO')
      .reduce((soma, linha) => soma + Number(linha.valor), 0)
    const totalPendente = total - totalPago
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
