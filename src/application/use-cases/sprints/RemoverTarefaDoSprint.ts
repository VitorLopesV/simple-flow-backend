import type { Tarefa } from '../../../domain/entities/Tarefa'
import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA, MENSAGEM_TAREFA_TRAVADA, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'

export class RemoverTarefaDoSprint {
  constructor(private readonly tarefaRepository: TarefaRepository) {}

  /**
   * Devolve a tarefa ao backlog (ela continua existindo e mantém o dia). Dia que já passou
   * trava: sem isso daria para tirar tarefas vencidas e inflar o percentual.
   */
  async execute(userId: ID, tarefaId: ID, agora: Date = new Date()): Promise<Tarefa> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, tarefaId)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)

    if (tarefaTravada(tarefa, dataAtual(agora))) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
    if (!tarefa.sprintId) throw new ConflictError('A tarefa não está no sprint.')

    return this.tarefaRepository.definirSprint(userId, tarefaId, { sprintId: null })
  }
}
