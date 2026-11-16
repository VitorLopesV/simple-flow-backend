import type { ID } from '../../shared/types/common'
import type { TarefaDoSprint } from '../entities/PlacarDoSprint'

/** Leitura das tarefas que estão em um sprint, já no formato do placar. */
export interface TarefasDoSprintRepository {
  listar(userId: ID, sprintId: ID, inicio: string, fim: string): Promise<TarefaDoSprint[]>
}
