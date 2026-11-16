import { NotFoundError } from '../../../domain/errors/DomainError'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'

export class RemoverTarefa {
  constructor(private readonly tarefaRepository: TarefaRepository) {}

  async execute(userId: ID, id: ID): Promise<void> {
    if (!(await this.tarefaRepository.buscarPorId(userId, id))) throw new NotFoundError('Tarefa')
    await this.tarefaRepository.remover(userId, id)
  }
}
