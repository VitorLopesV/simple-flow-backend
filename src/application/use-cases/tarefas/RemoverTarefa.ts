import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_TRAVADA, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'
import type { FecharSprintsVencidos } from '../sprints/FecharSprintsVencidos'
import { ConcluirSuperTaskSeCompleta } from '../superTasks/ConcluirSuperTaskSeCompleta'
import { MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_EXCLUI, tarefaNoSprintAberto } from './sprintAbertoDaTarefa'

export class RemoverTarefa {
  private readonly concluirSuperTask: ConcluirSuperTaskSeCompleta

  constructor(
    private readonly tarefaRepository: TarefaRepository,
    superTaskRepository: SuperTaskRepository,
    private readonly sprintRepository: SprintRepository,
    /** Fecha antes o sprint vencido (#71): liberar a tarefa concluída não depende só do cron. */
    private readonly fecharVencidos?: Pick<FecharSprintsVencidos, 'execute'>,
  ) {
    this.concluirSuperTask = new ConcluirSuperTaskSeCompleta(superTaskRepository, tarefaRepository)
  }

  /**
   * Tarefa de dia que já passou no sprint não some: só pode ser concluída. Tarefa concluída (#73, que ajusta a
   * recusa total da #70) só é excluída depois que o sprint dela fechou: a foto e o histórico não dependem mais
   * dela. Concluída sem sprint também pode. Filha excluída sai da conta da Super task (#65): se era a única que
   * faltava, o progresso chega a 100% e ela se conclui.
   */
  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<void> {
    await this.fecharVencidos?.execute(userId, agora)

    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) {
      if (await tarefaNoSprintAberto(this.sprintRepository, userId, tarefa)) {
        throw new ConflictError(MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_EXCLUI)
      }
    } else if (tarefaTravada(tarefa, dataAtual(agora))) {
      throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
    }
    await this.tarefaRepository.remover(userId, id)
    await this.concluirSuperTask.execute(userId, tarefa.superTaskId, agora)
  }
}
