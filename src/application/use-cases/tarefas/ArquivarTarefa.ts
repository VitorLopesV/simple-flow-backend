import type { Tarefa } from '../../../domain/entities/Tarefa'
import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_TRAVADA, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'
import type { FecharSprintsVencidos } from '../sprints/FecharSprintsVencidos'
import { MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_ARQUIVA, tarefaNoSprintAberto } from './sprintAbertoDaTarefa'

export class ArquivarTarefa {
  constructor(
    private readonly tarefaRepository: TarefaRepository,
    private readonly sprintRepository: SprintRepository,
    /** Fecha antes o sprint vencido (#71): liberar a tarefa concluída não depende só do cron. */
    private readonly fecharVencidos?: Pick<FecharSprintsVencidos, 'execute'>,
  ) {}

  /**
   * Idempotente: arquivar de novo não troca a data do arquivamento original.
   *
   * Tarefa concluída (#73, que ajusta a recusa total da #70): só pode ser arquivada depois que o sprint dela
   * fechou. Editar e mudar de área continuam recusados em tarefa concluída. Arquivar não mexe na foto do sprint
   * nem no histórico, que são lidos só da foto gravada no fechamento.
   */
  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<Tarefa> {
    await this.fecharVencidos?.execute(userId, agora)

    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.arquivada) return tarefa

    if (tarefa.concluida) {
      if (await tarefaNoSprintAberto(this.sprintRepository, userId, tarefa)) {
        throw new ConflictError(MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_ARQUIVA)
      }
      return this.tarefaRepository.definirArquivamento(userId, id, agora.toISOString())
    }

    // Arquivar tiraria a tarefa do compromisso da semana, então segue as mesmas travas da remoção.
    if (tarefaTravada(tarefa, dataAtual(agora))) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
    if (tarefa.sprintId) throw new ConflictError('A tarefa está no sprint: remova-a do sprint antes de arquivar.')

    return this.tarefaRepository.definirArquivamento(userId, id, agora.toISOString())
  }
}
