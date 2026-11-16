import type { SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import { NotFoundError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'
import { detalharSuperTask } from './detalharSuperTask'

export class DesmarcarSuperTaskConcluida {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {}

  /**
   * Reabre a Super task (volta a aceitar filhas e edição). As filhas concluídas continuam concluídas.
   * Sem confirmação. Idempotente: já aberta devolve como está.
   */
  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const superTask = await this.superTaskRepository.buscarPorId(userId, id)
    if (!superTask) throw new NotFoundError('Super task')
    const reaberta = superTask.concluida ? await this.superTaskRepository.definirConclusao(userId, id, null) : superTask
    const filhas = await this.tarefaRepository.listarDasSuperTasks(userId, [id])
    return detalharSuperTask(reaberta, filhas, agora)
  }
}
