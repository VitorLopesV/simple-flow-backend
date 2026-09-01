import type { Saida, SaidaPayload, SaidaResumo, SaidaStatus } from '../entities/Saida'
import type { ID, Paginated, Periodo } from '../../shared/types/common'

export interface SaidaFiltro {
  periodo: Periodo
  categoriaId?: ID | null
  status?: SaidaStatus | null
  busca?: string
  page: number
  pageSize: number
}

export interface SaidaRepository {
  listar(userId: ID, filtro: SaidaFiltro): Promise<Paginated<Saida>>
  resumo(userId: ID, periodo: Periodo): Promise<SaidaResumo>
  /** Saídas reais do período + projeção das séries recorrentes (ver `shared/utils/recorrencia.ts`), sem paginação/filtro — usado pelo dashboard para montar a série de vários meses. */
  listarComProjecao(userId: ID, periodo: Periodo): Promise<Saida[]>
  buscarPorId(userId: ID, id: ID): Promise<Saida | null>
  criar(userId: ID, payload: SaidaPayload): Promise<Saida>
  atualizar(userId: ID, id: ID, payload: SaidaPayload): Promise<Saida>
  remover(userId: ID, id: ID): Promise<void>
}
