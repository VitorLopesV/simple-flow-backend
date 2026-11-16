import type { Tarefa, TarefaEdicao } from '../../../domain/entities/Tarefa'
import { NotFoundError } from '../../../domain/errors/DomainError'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'

export class AtualizarTarefa {
  constructor(private readonly tarefaRepository: TarefaRepository) {}

  async execute(userId: ID, id: ID, edicao: TarefaEdicao): Promise<Tarefa> {
    if (!(await this.tarefaRepository.buscarPorId(userId, id))) throw new NotFoundError('Tarefa')
    return this.tarefaRepository.atualizar(userId, id, edicao)
  }
}
