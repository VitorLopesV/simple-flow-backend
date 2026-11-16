import type { Tarefa } from '../../../domain/entities/Tarefa'
import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'
import { EntrarNoSprintPorConclusao } from '../sprints/EntrarNoSprintPorConclusao'
import { ConcluirSuperTaskSeCompleta } from '../superTasks/ConcluirSuperTaskSeCompleta'

/**
 * Conclusão definitiva de uma tarefa (#70): grava `concluida_em` e não há volta (ver `DesmarcarConclusaoTarefa`
 * e as recusas de edição nos demais use-cases). O atraso não é gravado: sai de `tarefaAtrasada` na leitura.
 *
 * Ponto de extensão da #65, usado aqui: ao concluir uma filha, `ConcluirSuperTaskSeCompleta` conclui a Super task
 * se era a última que faltava. A Super task é uma entidade própria (não uma tarefa), então não passa por este
 * use-case. Só a conclusão nova dispara isso: concluir de novo (idempotente) devolve a tarefa sem mudar o
 * instante original e sem reconcluir uma Super task reaberta de propósito.
 */
export class ConcluirTarefa {
  private readonly entrarNoSprint: EntrarNoSprintPorConclusao
  private readonly concluirSuperTask: ConcluirSuperTaskSeCompleta

  constructor(
    private readonly tarefaRepository: TarefaRepository,
    sprintRepository: SprintRepository,
    superTaskRepository: SuperTaskRepository,
  ) {
    this.entrarNoSprint = new EntrarNoSprintPorConclusao(tarefaRepository, sprintRepository)
    this.concluirSuperTask = new ConcluirSuperTaskSeCompleta(superTaskRepository, tarefaRepository)
  }

  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<Tarefa> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) return tarefa
    if (tarefa.arquivada) throw new ValidationError('Tarefas arquivadas não podem ser concluídas: desarquive antes.')

    // Concluir num dia útil uma tarefa fora do sprint a puxa para o sprint atual, naquele dia.
    // Feito antes de gravar a conclusão, para o atraso já considerar o dia em que ela entrou.
    await this.entrarNoSprint.execute(userId, id, agora)

    const concluida = await this.tarefaRepository.concluir(userId, id, agora.toISOString())
    await this.concluirSuperTask.execute(userId, concluida.superTaskId, agora)
    return concluida
  }
}
