import type { ID } from '../../shared/types/common'
import type { TarefaDoSprint } from '../entities/PlacarDoSprint'

/** Leitura das tarefas que estão em um sprint, já no formato do placar. */
export interface TarefasDoSprintRepository {
  listar(userId: ID, sprintId: ID, inicio: string, fim: string): Promise<TarefaDoSprint[]>
  /**
   * Fechamento: tira do sprint as tarefas não concluídas (voltam para a área) e marca nelas o sprint de
   * origem (`inicio`). Idempotente: só toca em tarefa ainda vinculada e sem conclusão.
   */
  devolverNaoConcluidas(userId: ID, sprintId: ID, inicio: string): Promise<void>
}
