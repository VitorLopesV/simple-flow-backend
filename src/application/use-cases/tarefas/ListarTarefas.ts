import type { FiltroTarefas, Tarefa } from '../../../domain/entities/Tarefa'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'

export class ListarTarefas {
  constructor(private readonly tarefaRepository: TarefaRepository) {}

  execute(userId: ID, filtro: FiltroTarefas): Promise<Tarefa[]> {
    return this.tarefaRepository.listar(userId, filtro)
  }
}
