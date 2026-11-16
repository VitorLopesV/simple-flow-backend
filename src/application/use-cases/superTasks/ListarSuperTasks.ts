import type { FiltroSuperTasks, SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'
import { detalharSuperTask } from './detalharSuperTask'

export class ListarSuperTasks {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {}

  async execute(userId: ID, filtro: FiltroSuperTasks, agora: Date = new Date()): Promise<SuperTaskDetalhada[]> {
    const superTasks = await this.superTaskRepository.listar(userId, filtro)
    const filhas = await this.tarefaRepository.listarDasSuperTasks(
      userId,
      superTasks.map((superTask) => superTask.id),
    )
    return superTasks.map((superTask) =>
      detalharSuperTask(
        superTask,
        filhas.filter((filha) => filha.superTaskId === superTask.id),
        agora,
      ),
    )
  }
}
