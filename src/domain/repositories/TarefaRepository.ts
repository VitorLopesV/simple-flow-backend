import type { ID } from '../../shared/types/common'
import type { FiltroTarefas, Tarefa, TarefaEdicao, TarefaPayload } from '../entities/Tarefa'

export interface TarefaRepository {
  /** Mais recentes primeiro. */
  listar(userId: ID, filtro: FiltroTarefas): Promise<Tarefa[]>
  buscarPorId(userId: ID, id: ID): Promise<Tarefa | null>
  criar(userId: ID, payload: TarefaPayload): Promise<Tarefa>
  atualizar(userId: ID, id: ID, edicao: TarefaEdicao): Promise<Tarefa>
  mover(userId: ID, id: ID, areaId: ID): Promise<Tarefa>
  /** `null` desarquiva. */
  definirArquivamento(userId: ID, id: ID, arquivadaEm: string | null): Promise<Tarefa>
  remover(userId: ID, id: ID): Promise<void>
}
