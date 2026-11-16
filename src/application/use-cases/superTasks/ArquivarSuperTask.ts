import type { SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import { NotFoundError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'
import { detalharSuperTask } from './detalharSuperTask'

/** Arquivar e desarquivar a Super task (a concluída pode ser arquivada). Idempotentes. */
export class ArquivarSuperTask {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {}

  async execute(userId: ID, id: ID, arquivar: boolean, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const superTask = await this.superTaskRepository.buscarPorId(userId, id)
    if (!superTask) throw new NotFoundError('Super task')

    const atual =
      superTask.arquivada === arquivar
        ? superTask
        : await this.superTaskRepository.definirArquivamento(userId, id, arquivar ? agora.toISOString() : null)
    const filhas = await this.tarefaRepository.listarDasSuperTasks(userId, [id])
    return detalharSuperTask(atual, filhas, agora)
  }
}
