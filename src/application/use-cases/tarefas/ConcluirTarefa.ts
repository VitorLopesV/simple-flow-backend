import type { Tarefa } from '../../../domain/entities/Tarefa'
import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'
import { EntrarNoSprintPorConclusao } from '../sprints/EntrarNoSprintPorConclusao'

/**
 * Conclusão definitiva de uma tarefa (#70): grava `concluida_em` e não há volta (ver `DesmarcarConclusaoTarefa`
 * e as recusas de edição nos demais use-cases). O atraso não é gravado: sai de `tarefaAtrasada` na leitura.
 *
 * Ponto de extensão da #65: a conclusão automática da Super task ao concluir a última filha deve chamar
 * `execute(userId, superTaskId, agora)` deste mesmo use-case, depois da conclusão da filha, em vez de gravar
 * `concluida_em` por conta própria. Idempotente: concluir de novo devolve a tarefa sem mudar o instante original.
 */
export class ConcluirTarefa {
  private readonly entrarNoSprint: EntrarNoSprintPorConclusao

  constructor(
    private readonly tarefaRepository: TarefaRepository,
    sprintRepository: SprintRepository,
  ) {
    this.entrarNoSprint = new EntrarNoSprintPorConclusao(tarefaRepository, sprintRepository)
  }

  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<Tarefa> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) return tarefa
    if (tarefa.arquivada) throw new ValidationError('Tarefas arquivadas não podem ser concluídas: desarquive antes.')

    // Concluir num dia útil uma tarefa fora do sprint a puxa para o sprint atual, naquele dia.
    // Feito antes de gravar a conclusão, para o atraso já considerar o dia em que ela entrou.
    await this.entrarNoSprint.execute(userId, id, agora)

    return this.tarefaRepository.concluir(userId, id, agora.toISOString())
  }
}
