import type { SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import { NotFoundError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'
import { detalharSuperTask } from './detalharSuperTask'

export class ObterSuperTask {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {}

  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const superTask = await this.superTaskRepository.buscarPorId(userId, id)
    if (!superTask) throw new NotFoundError('Super task')
    const filhas = await this.tarefaRepository.listarDasSuperTasks(userId, [id])
    return detalharSuperTask(superTask, filhas, agora)
  }
}
