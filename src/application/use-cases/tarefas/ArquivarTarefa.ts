import type { Tarefa } from '../../../domain/entities/Tarefa'
import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA, MENSAGEM_TAREFA_TRAVADA, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'

export class ArquivarTarefa {
  constructor(private readonly tarefaRepository: TarefaRepository) {}

  /** Idempotente: arquivar de novo não troca a data do arquivamento original. */
  async execute(userId: ID, id: ID, agora: Date = new Date()): Promise<Tarefa> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.arquivada) return tarefa
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)
    // Arquivar tiraria a tarefa do compromisso da semana, então segue as mesmas travas da remoção.
    if (tarefaTravada(tarefa, dataAtual(agora))) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
    if (tarefa.sprintId) throw new ConflictError('A tarefa está no sprint: remova-a do sprint antes de arquivar.')

    return this.tarefaRepository.definirArquivamento(userId, id, agora.toISOString())
  }
}
