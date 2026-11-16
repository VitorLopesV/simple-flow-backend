import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA, MENSAGEM_TAREFA_TRAVADA, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'
import { ConcluirSuperTaskSeCompleta } from '../superTasks/ConcluirSuperTaskSeCompleta'

export class RemoverTarefa {
  private readonly concluirSuperTask: ConcluirSuperTaskSeCompleta

  constructor(
    private readonly tarefaRepository: TarefaRepository,
    superTaskRepository: SuperTaskRepository,
  ) {
    this.concluirSuperTask = new ConcluirSuperTaskSeCompleta(superTaskRepository, tarefaRepository)
  }

  /**
   * Tarefa de dia que já passou no sprint não some: só pode ser concluída. Filha excluída sai da conta da
   * Super task (#65): se era a única que faltava, o progresso chega a 100% e ela se conclui.
   */
  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<void> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)
    if (tarefaTravada(tarefa, dataAtual(agora))) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
    await this.tarefaRepository.remover(userId, id)
    await this.concluirSuperTask.execute(userId, tarefa.superTaskId, agora)
  }
}
