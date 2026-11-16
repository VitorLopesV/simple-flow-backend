import type { DestinoDasFilhas } from '../../../domain/entities/SuperTask'
import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_TRAVADA, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'

export class RemoverSuperTask {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {}

  /**
   * Escolha explícita do destino das filhas: `SOLTAR` (viram tarefas avulsas na mesma área) ou `EXCLUIR`
   * (saem junto). Bloqueada (409) se alguma filha ainda está no sprint aberto, sem concluir. `EXCLUIR`
   * também é recusado com filha concluída (concluir é definitivo, #70, e apagar tarefa concluída
   * tiraria pontos de um sprint) ou travada: nesse caso use `SOLTAR`. Tudo é checado antes de escrever.
   */
  async execute(userId: ID, id: ID, destino: DestinoDasFilhas, agora: Date = new Date()): Promise<void> {
    const superTask = await this.superTaskRepository.buscarPorId(userId, id)
    if (!superTask) throw new NotFoundError('Super task')

    const filhas = await this.tarefaRepository.listarDasSuperTasks(userId, [id])
    // Sprint aberto = a tarefa está num sprint e ainda não foi concluída (concluída fica no histórico).
    if (filhas.some((filha) => filha.sprintId !== null && !filha.concluida)) {
      throw new ConflictError('Há filhas no sprint aberto: remova-as do sprint ou conclua-as antes de excluir a Super task.')
    }

    if (destino === 'EXCLUIR') {
      if (filhas.some((filha) => filha.concluida)) {
        throw new ConflictError(
          'Há filhas concluídas, que não podem ser excluídas (a conclusão é definitiva): solte as filhas em vez de excluí-las junto.',
        )
      }
      if (filhas.some((filha) => tarefaTravada(filha, dataAtual(agora)))) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
      await this.tarefaRepository.removerDaSuperTask(userId, id)
    } else {
      await this.tarefaRepository.soltarDaSuperTask(userId, id)
    }
    await this.superTaskRepository.remover(userId, id)
  }
}
