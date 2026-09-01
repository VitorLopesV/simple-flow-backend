import type { Entrada, EntradaPayload, EntradaResumo } from '../entities/Entrada'
import type { ID, Paginated, Periodo } from '../../shared/types/common'

export interface EntradaFiltro {
  periodo: Periodo
  categoriaId?: ID | null
  busca?: string
  page: number
  pageSize: number
}

export interface EntradaRepository {
  listar(userId: ID, filtro: EntradaFiltro): Promise<Paginated<Entrada>>
  resumo(userId: ID, periodo: Periodo): Promise<EntradaResumo>
  /** Entradas reais do período + projeção das séries recorrentes (ver `shared/utils/recorrencia.ts`), sem paginação/filtro — usado pelo dashboard para montar a série de vários meses. */
  listarComProjecao(userId: ID, periodo: Periodo): Promise<Entrada[]>
  criar(userId: ID, payload: EntradaPayload): Promise<Entrada>
  atualizar(userId: ID, id: ID, payload: EntradaPayload): Promise<Entrada>
  remover(userId: ID, id: ID): Promise<void>
}
