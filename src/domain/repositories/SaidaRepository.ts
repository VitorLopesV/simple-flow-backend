import type { Saida, SaidaPayload, SaidaResumo, SaidaStatus } from '../entities/Saida'
import type { ControleDeSerie } from '../entities/Recorrencia'
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
  /** Saídas do período + as faturas de cartão que vencem nele, sem paginação/filtro — usado pelo dashboard para montar a série de vários meses. */
  listarDoPeriodo(userId: ID, periodo: Periodo): Promise<Saida[]>
  buscarPorId(userId: ID, id: ID): Promise<Saida | null>
  criar(userId: ID, payload: SaidaPayload, controle?: Partial<ControleDeSerie>): Promise<Saida>
  /** Campos de `controle` ausentes mantêm o valor gravado. */
  atualizar(userId: ID, id: ID, payload: SaidaPayload, controle?: Partial<ControleDeSerie>): Promise<Saida>
  remover(userId: ID, id: ID): Promise<void>
}
