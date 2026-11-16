import type { SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA } from '../../../domain/services/sprintDaTarefa'
import { MENSAGEM_SUPER_TASK_CONCLUIDA } from '../../../domain/services/superTaskConcluida'
import type { ID } from '../../../shared/types/common'
import { ObterSuperTask } from './ObterSuperTask'

export class AdicionarTarefaASuperTask {
  private readonly obter: ObterSuperTask

  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {
    this.obter = new ObterSuperTask(superTaskRepository, tarefaRepository)
  }

  /**
   * Tarefa avulsa e não concluída entra como filha. Super task concluída não aceita filhas novas até
   * ser reaberta; a filha precisa estar na mesma área (mova uma das duas antes). Como a Super task
   * não está concluída, a filha nova faz o progresso cair e ela segue "em andamento".
   */
  async execute(userId: ID, id: ID, tarefaId: ID, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const superTask = await this.superTaskRepository.buscarPorId(userId, id)
    if (!superTask) throw new NotFoundError('Super task')
    if (superTask.concluida) throw new ConflictError(MENSAGEM_SUPER_TASK_CONCLUIDA)

    const tarefa = await this.tarefaRepository.buscarPorId(userId, tarefaId)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)
    if (tarefa.superTaskId === id) return this.obter.execute(userId, id, agora)
    if (tarefa.superTaskId) throw new ConflictError('A tarefa já é filha de outra Super task: retire-a de lá antes.')
    if (tarefa.arquivada) throw new ValidationError('Tarefas arquivadas não podem virar filhas: desarquive antes.')
    if (tarefa.areaId !== superTask.areaId) {
      throw new ValidationError('A tarefa precisa estar na mesma área da Super task: mova uma delas antes.')
    }

    await this.tarefaRepository.definirSuperTask(userId, tarefaId, id)
    return this.obter.execute(userId, id, agora)
  }
}
