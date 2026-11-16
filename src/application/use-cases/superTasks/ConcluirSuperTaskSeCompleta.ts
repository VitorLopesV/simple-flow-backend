import type { SuperTask } from '../../../domain/entities/SuperTask'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { todasConcluidas } from '../../../domain/services/progressoDaSuperTask'
import type { ID } from '../../../shared/types/common'

/**
 * Conclusão automática (#65): quando todas as filhas estão concluídas a Super task se conclui sozinha.
 * Chamada depois de concluir uma filha (`ConcluirTarefa`) e depois que uma filha incompleta sai da conta
 * (excluída ou retirada). Silenciosa: não faz nada se ainda faltam filhas, se não há filhas ou se já está
 * concluída. NÃO é chamada ao reabrir: reaberta ainda em 100% fica aberta até ser marcada de novo.
 *
 * A Super task é uma entidade própria (tabela `super_tasks`), não uma tarefa: por isso o ponto de extensão
 * deixado em `ConcluirTarefa` chama este use-case em vez de `ConcluirTarefa.execute(superTaskId)`.
 */
export class ConcluirSuperTaskSeCompleta {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
  ) {}

  async execute(userId: ID, superTaskId: ID | null, agora: Date = new Date()): Promise<SuperTask | null> {
    if (!superTaskId) return null
    const superTask = await this.superTaskRepository.buscarPorId(userId, superTaskId)
    if (!superTask || superTask.concluida) return superTask

    const filhas = await this.tarefaRepository.listarDasSuperTasks(userId, [superTaskId])
    if (!todasConcluidas(filhas)) return superTask
    return this.superTaskRepository.definirConclusao(userId, superTaskId, agora.toISOString())
  }
}
