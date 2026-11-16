import type { Tarefa, TarefaEdicao } from '../../../domain/entities/Tarefa'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import {
  MENSAGEM_TAREFA_CONCLUIDA,
  MENSAGEM_TAREFA_TRAVADA,
  inicioDoSprintDoDia,
  motivoDeRecusa,
  tarefaTravada,
} from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'
import { garantirSprintDoDia } from '../sprints/garantirSprintDoDia'

export class AtualizarTarefa {
  constructor(
    private readonly tarefaRepository: TarefaRepository,
    private readonly sprintRepository: SprintRepository,
  ) {}

  /**
   * Além de editar:
   * - tarefa de dia que já passou no sprint não edita (só conclui);
   * - tarefa no sprint precisa continuar válida para ele (dia seg–sex de hoje em diante, com
   *   tempo, dificuldade e prioridade); trocar para o dia de outra semana a muda de sprint;
   * - tarefa fora do sprint que ganha um dia válido no sprint atual ou no próximo entra nele.
   */
  async execute(userId: ID, id: ID, edicao: TarefaEdicao, agora: Date = new Date()): Promise<Tarefa> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)

    const hoje = dataAtual(agora)
    if (tarefaTravada(tarefa, hoje)) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)

    if (tarefa.sprintId) {
      const motivo = motivoDeRecusa(edicao, hoje)
      if (motivo) throw new ValidationError(`${motivo} Para tirar a tarefa do sprint, remova-a do sprint.`)

      if (inicioDoSprintDoDia(edicao.dia!) === inicioDoSprintDoDia(tarefa.dia!)) {
        return this.tarefaRepository.atualizar(userId, id, edicao)
      }
      const sprintId = await garantirSprintDoDia(this.sprintRepository, userId, edicao.dia!)
      return this.tarefaRepository.atualizar(userId, id, edicao, sprintId)
    }

    // Só dar um dia novo coloca no sprint: salvar de novo o mesmo dia não desfaz uma remoção manual.
    const entraNoSprint =
      !tarefa.arquivada && edicao.dia !== null && edicao.dia !== tarefa.dia && motivoDeRecusa(edicao, hoje) === null
    if (!entraNoSprint) return this.tarefaRepository.atualizar(userId, id, edicao)

    const sprintId = await garantirSprintDoDia(this.sprintRepository, userId, edicao.dia!)
    return this.tarefaRepository.atualizar(userId, id, edicao, sprintId)
  }
}
