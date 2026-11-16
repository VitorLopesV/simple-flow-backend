import type { SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { detalharSuperTask } from './detalharSuperTask'

export class ConverterTarefaEmSuperTask {
  constructor(
    private readonly tarefaRepository: TarefaRepository,
    private readonly superTaskRepository: SuperTaskRepository,
  ) {}

  /**
   * A tarefa vira uma Super task (título, área e notas passam adiante; dia, hora, tempo, dificuldade e
   * prioridade não existem na Super task) e deixa de existir como tarefa. Só converte tarefa que não
   * está no sprint nem concluída; filha de outra Super task não converte (um nível só) e arquivada
   * precisa ser desarquivada antes.
   */
  async execute(userId: ID, tarefaId: ID, dataTermino: string | null, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, tarefaId)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)
    if (tarefa.sprintId) throw new ConflictError('A tarefa está no sprint: remova-a do sprint antes de convertê-la em Super task.')
    if (tarefa.superTaskId) throw new ConflictError('A tarefa já é filha de uma Super task: uma Super task não pode ser filha de outra.')
    if (tarefa.arquivada) throw new ValidationError('Tarefas arquivadas não podem ser convertidas: desarquive antes.')

    const superTask = await this.superTaskRepository.criar(userId, {
      areaId: tarefa.areaId,
      titulo: tarefa.titulo,
      notas: tarefa.notas,
      dataTermino,
    })
    try {
      await this.tarefaRepository.remover(userId, tarefaId)
    } catch (erro) {
      // Sem transação: se a tarefa não saiu, desfaz a Super task para não deixar uma cópia.
      await this.superTaskRepository.remover(userId, superTask.id).catch(() => undefined)
      throw erro
    }
    return detalharSuperTask(superTask, [], agora)
  }
}
