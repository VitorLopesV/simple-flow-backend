import type { SuperTaskDetalhada, SuperTaskEdicao } from '../../../domain/entities/SuperTask'
import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_SUPER_TASK_CONCLUIDA } from '../../../domain/services/superTaskConcluida'
import type { ID } from '../../../shared/types/common'
import { detalharSuperTask } from './detalharSuperTask'

export class AtualizarSuperTask {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {}

  /** Concluída está travada: reabra (desmarque) antes de editar. A área muda só por `MoverSuperTask`. */
  async execute(userId: ID, id: ID, edicao: SuperTaskEdicao, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const superTask = await this.superTaskRepository.buscarPorId(userId, id)
    if (!superTask) throw new NotFoundError('Super task')
    if (superTask.concluida) throw new ConflictError(MENSAGEM_SUPER_TASK_CONCLUIDA)

    const atualizada = await this.superTaskRepository.atualizar(userId, id, edicao)
    const filhas = await this.tarefaRepository.listarDasSuperTasks(userId, [id])
    return detalharSuperTask(atualizada, filhas, agora)
  }
}
