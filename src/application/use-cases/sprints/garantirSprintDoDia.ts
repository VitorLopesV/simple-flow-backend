import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import { fimDoSprint, inicioDoSprintDoDia } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'

/** Sprint (criado se preciso) da semana do dia informado; a elegibilidade do dia já foi checada antes. */
export async function garantirSprintDoDia(sprintRepository: SprintRepository, userId: ID, dia: string): Promise<ID> {
  const inicio = inicioDoSprintDoDia(dia)
  const sprint = await sprintRepository.garantir(userId, inicio, fimDoSprint(inicio))
  return sprint.id
}
