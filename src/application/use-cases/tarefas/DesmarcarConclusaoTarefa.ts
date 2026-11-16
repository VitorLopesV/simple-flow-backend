import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'

/** Concluir é definitivo: desmarcar é sempre recusado (existe só para a recusa ter mensagem clara e testável). */
export class DesmarcarConclusaoTarefa {
  constructor(private readonly tarefaRepository: TarefaRepository) {}

  async execute(userId: ID, id: ID): Promise<never> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)
    throw new ConflictError('Esta tarefa não está concluída.')
  }
}
