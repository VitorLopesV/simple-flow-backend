import type { SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { todasConcluidas } from '../../../domain/services/progressoDaSuperTask'
import type { ID } from '../../../shared/types/common'
import { detalharSuperTask } from './detalharSuperTask'

export class MarcarSuperTaskConcluida {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {}

  /**
   * Marcar de novo uma Super task reaberta que continua em 100%. Nunca abaixo de 100% (422). Sem
   * confirmação: ela não mexe em pontos. Idempotente: já concluída devolve como está.
   */
  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const superTask = await this.superTaskRepository.buscarPorId(userId, id)
    if (!superTask) throw new NotFoundError('Super task')
    const filhas = await this.tarefaRepository.listarDasSuperTasks(userId, [id])
    if (superTask.concluida) return detalharSuperTask(superTask, filhas, agora)

    if (!todasConcluidas(filhas)) {
      throw new ValidationError('A Super task só pode ser marcada como concluída com todas as filhas concluídas (100%).')
    }
    const concluida = await this.superTaskRepository.definirConclusao(userId, id, agora.toISOString())
    return detalharSuperTask(concluida, filhas, agora)
  }
}
