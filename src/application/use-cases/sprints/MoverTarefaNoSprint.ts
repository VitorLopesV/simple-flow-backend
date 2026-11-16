import type { Tarefa } from '../../../domain/entities/Tarefa'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA, MENSAGEM_TAREFA_TRAVADA, motivoDeRecusa, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'
import { garantirSprintDoDia } from './garantirSprintDoDia'

export class MoverTarefaNoSprint {
  constructor(
    private readonly tarefaRepository: TarefaRepository,
    private readonly sprintRepository: SprintRepository,
  ) {}

  /** Muda o dia de uma tarefa que está no sprint (hoje ou futuro, seg–sex), inclusive de um sprint para o outro. */
  async execute(userId: ID, tarefaId: ID, dia: string, agora: Date = new Date()): Promise<Tarefa> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, tarefaId)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)

    const hoje = dataAtual(agora)
    if (tarefaTravada(tarefa, hoje)) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
    if (!tarefa.sprintId) throw new ConflictError('A tarefa não está no sprint. Adicione-a antes de mudar o dia.')

    const motivo = motivoDeRecusa({ ...tarefa, dia }, hoje)
    if (motivo) throw new ValidationError(motivo)

    const sprintId = await garantirSprintDoDia(this.sprintRepository, userId, dia)
    return this.tarefaRepository.definirSprint(userId, tarefaId, { sprintId, dia })
  }
}
