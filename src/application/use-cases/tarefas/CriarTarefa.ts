import type { Tarefa, TarefaPayload } from '../../../domain/entities/Tarefa'
import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { motivoDeRecusa } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'
import { garantirSprintDoDia } from '../sprints/garantirSprintDoDia'

export class CriarTarefa {
  constructor(
    private readonly tarefaRepository: TarefaRepository,
    private readonly areaRepository: AreaRepository,
    private readonly sprintRepository: SprintRepository,
  ) {}

  /** Tarefa já criada com dia válido no sprint atual ou no próximo (e pontuação completa) entra nele. */
  async execute(userId: ID, payload: TarefaPayload, agora: Date = new Date()): Promise<Tarefa> {
    const area = await this.areaRepository.buscarPorId(userId, payload.areaId)
    if (!area) throw new NotFoundError('Área')
    // A Rotina só guarda itens de rotina, nunca tarefas comuns.
    if (area.sistema) throw new ValidationError('A área Rotina não aceita tarefas.')

    if (payload.dia === null || motivoDeRecusa(payload, dataAtual(agora), agora) !== null) {
      return this.tarefaRepository.criar(userId, payload)
    }
    const sprintId = await garantirSprintDoDia(this.sprintRepository, userId, payload.dia)
    return this.tarefaRepository.criar(userId, payload, sprintId)
  }
}
