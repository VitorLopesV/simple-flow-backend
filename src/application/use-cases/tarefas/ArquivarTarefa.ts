import type { Tarefa } from '../../../domain/entities/Tarefa'
import { NotFoundError } from '../../../domain/errors/DomainError'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'

export class ArquivarTarefa {
  constructor(private readonly tarefaRepository: TarefaRepository) {}

  /** Idempotente: arquivar de novo não troca a data do arquivamento original. */
  async execute(userId: ID, id: ID): Promise<Tarefa> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.arquivada) return tarefa

    return this.tarefaRepository.definirArquivamento(userId, id, new Date().toISOString())
  }
}
