import type { SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA } from '../../../domain/services/sprintDaTarefa'
import { MENSAGEM_SUPER_TASK_CONCLUIDA } from '../../../domain/services/superTaskConcluida'
import type { ID } from '../../../shared/types/common'
import { ConcluirSuperTaskSeCompleta } from './ConcluirSuperTaskSeCompleta'
import { ObterSuperTask } from './ObterSuperTask'

export class RetirarTarefaDaSuperTask {
  private readonly obter: ObterSuperTask
  private readonly concluirSeCompleta: ConcluirSuperTaskSeCompleta

  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {
    this.obter = new ObterSuperTask(superTaskRepository, tarefaRepository)
    this.concluirSeCompleta = new ConcluirSuperTaskSeCompleta(superTaskRepository, tarefaRepository)
  }

  /**
   * A tarefa volta a ser avulsa (mesma área). Filha concluída não sai (a conclusão é definitiva, #70, e
   * ela continua contando como feita) e Super task concluída está travada. Se a filha retirada era a
   * única que faltava, o progresso chega a 100% e a Super task se conclui.
   */
  async execute(userId: ID, id: ID, tarefaId: ID, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const superTask = await this.superTaskRepository.buscarPorId(userId, id)
    if (!superTask) throw new NotFoundError('Super task')
    if (superTask.concluida) throw new ConflictError(MENSAGEM_SUPER_TASK_CONCLUIDA)

    const tarefa = await this.tarefaRepository.buscarPorId(userId, tarefaId)
    if (!tarefa || tarefa.superTaskId !== id) throw new NotFoundError('Tarefa nesta Super task')
    if (tarefa.concluida) {
      throw new ConflictError(`${MENSAGEM_TAREFA_CONCLUIDA} Uma filha concluída não pode ser retirada da Super task.`)
    }

    await this.tarefaRepository.definirSuperTask(userId, tarefaId, null)
    await this.concluirSeCompleta.execute(userId, id, agora)
    return this.obter.execute(userId, id, agora)
  }
}
