import type { Entrada, EntradaPayload, EntradaResumo, EntradaTipo } from '../entities/Entrada'
import type { ControleDeSerie } from '../entities/Recorrencia'
import type { ID, Paginated, Periodo } from '../../shared/types/common'

export interface EntradaFiltro {
  periodo: Periodo
  categoriaId?: ID | null
  tipo?: EntradaTipo | null
  busca?: string
  page: number
  pageSize: number
}

export interface EntradaRepository {
  listar(userId: ID, filtro: EntradaFiltro): Promise<Paginated<Entrada>>
  resumo(userId: ID, periodo: Periodo): Promise<EntradaResumo>
  /** Entradas do período, sem paginação/filtro — usado pelo dashboard para montar a série de vários meses. */
  listarDoPeriodo(userId: ID, periodo: Periodo): Promise<Entrada[]>
  buscarPorId(userId: ID, id: ID): Promise<Entrada | null>
  criar(userId: ID, payload: EntradaPayload, controle?: Partial<ControleDeSerie>): Promise<Entrada>
  /** Campos de `controle` ausentes mantêm o valor gravado. */
  atualizar(userId: ID, id: ID, payload: EntradaPayload, controle?: Partial<ControleDeSerie>): Promise<Entrada>
  remover(userId: ID, id: ID): Promise<void>
}
