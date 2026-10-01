import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Entrada, EntradaPayload, EntradaResumo } from '../../../domain/entities/Entrada'
import type { ControleDeSerie } from '../../../domain/entities/Recorrencia'
import type { EntradaFiltro, EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID, Paginated, Periodo } from '../../../shared/types/common'
import { faixaDaPagina, montarPaginado } from '../../../shared/utils/paginacao'
import { limitesDoMes, mesAnterior } from '../../../shared/utils/periodo'
import type { Database } from '../database.types'
import { paraLinhaDeControle } from './controleDeSerie'

type EntradaRow = Database['public']['Tables']['entradas']['Row']

function paraEntrada(row: EntradaRow): Entrada {
  return {
    id: row.id,
    descricao: row.descricao,
    valor: Number(row.valor),
    data: row.data,
    categoriaId: row.categoria_id,
    tipo: row.tipo as Entrada['tipo'],
    recorrente: row.recorrente,
    observacao: row.observacao,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    serieId: row.serie_id,
    editadoManualmente: row.editado_manualmente,
  }
}

function paraLinha(payload: EntradaPayload) {
  return {
    descricao: payload.descricao,
    valor: payload.valor,
    data: payload.data,
    categoria_id: payload.categoriaId,
    tipo: payload.tipo,
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
   * Entradas do período, da mais recente para a mais antiga. Recorrências já são
   * registros reais (ver `ControleDeSerie`), então não há nada a projetar. Público
   * porque o dashboard (`SupabaseDashboardRepository`) reusa esta mesma leitura mês a mês.
   */
  async listarDoPeriodo(userId: ID, periodo: Periodo): Promise<Entrada[]> {
    const { inicio, fim } = limitesDoMes(periodo)

    const { data, error } = await this.supabase
      .from('entradas')
      .select('*')
      .eq('user_id', userId)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data', { ascending: false })

    if (error) throw error
    return data.map(paraEntrada)
  }

  async listar(userId: ID, filtro: EntradaFiltro): Promise<Paginated<Entrada>> {
    const todas = await this.listarDoPeriodo(userId, filtro.periodo)
    const busca = filtro.busca?.toLocaleLowerCase()

    const filtradas = todas
      .filter((entrada) => !filtro.categoriaId || entrada.categoriaId === filtro.categoriaId)
      .filter((entrada) => !filtro.tipo || entrada.tipo === filtro.tipo)
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
      this.listarDoPeriodo(userId, periodo),
      this.listarDoPeriodo(userId, mesAnterior(periodo)),
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

  async buscarPorId(userId: ID, id: ID): Promise<Entrada | null> {
    const { data, error } = await this.supabase
      .from('entradas')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? paraEntrada(data) : null
  }

  async criar(userId: ID, payload: EntradaPayload, controle?: Partial<ControleDeSerie>): Promise<Entrada> {
    const { data, error } = await this.supabase
      .from('entradas')
      .insert({ ...paraLinha(payload), ...paraLinhaDeControle(controle), user_id: userId })
      .select('*')
      .single()

    if (error) throw error
    return paraEntrada(data)
  }

  async atualizar(userId: ID, id: ID, payload: EntradaPayload, controle?: Partial<ControleDeSerie>): Promise<Entrada> {
    const { data, error } = await this.supabase
      .from('entradas')
      .update({ ...paraLinha(payload), ...paraLinhaDeControle(controle) })
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
