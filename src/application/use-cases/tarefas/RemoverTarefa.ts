import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA, MENSAGEM_TAREFA_TRAVADA, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'

export class RemoverTarefa {
  constructor(private readonly tarefaRepository: TarefaRepository) {}

  /** Tarefa de dia que já passou no sprint não some: só pode ser concluída. */
  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<void> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)
    if (tarefaTravada(tarefa, dataAtual(agora))) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
    await this.tarefaRepository.remover(userId, id)
  }
}
