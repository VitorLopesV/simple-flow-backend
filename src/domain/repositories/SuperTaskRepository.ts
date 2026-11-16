import type { ID } from '../../shared/types/common'
import type { FiltroSuperTasks, SuperTask, SuperTaskEdicao, SuperTaskPayload } from '../entities/SuperTask'

export interface SuperTaskRepository {
  /** Mais recentes primeiro. */
  listar(userId: ID, filtro: FiltroSuperTasks): Promise<SuperTask[]>
  buscarPorId(userId: ID, id: ID): Promise<SuperTask | null>
  criar(userId: ID, payload: SuperTaskPayload): Promise<SuperTask>
  atualizar(userId: ID, id: ID, edicao: SuperTaskEdicao): Promise<SuperTask>
  mover(userId: ID, id: ID, areaId: ID): Promise<SuperTask>
  /** Instante da conclusão; `null` reabre. */
  definirConclusao(userId: ID, id: ID, concluidaEm: string | null): Promise<SuperTask>
  /** `null` desarquiva. */
  definirArquivamento(userId: ID, id: ID, arquivadaEm: string | null): Promise<SuperTask>
  remover(userId: ID, id: ID): Promise<void>
}
