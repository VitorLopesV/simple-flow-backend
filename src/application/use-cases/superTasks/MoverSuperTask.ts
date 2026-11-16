import type { SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import { MENSAGEM_SUPER_TASK_CONCLUIDA } from '../../../domain/services/superTaskConcluida'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'
import { detalharSuperTask } from './detalharSuperTask'

export class MoverSuperTask {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly tarefaRepository: TarefaRepository,
    private readonly areaRepository: AreaRepository,
  ) {}

  /**
   * Mover a Super task move as filhas (a área é a mesma). Concluída está travada, e filha concluída ou
   * travada pelo sprint não pode mudar de área (#70): nesses casos a mudança é recusada (409) em vez de
   * mover só parte do grupo. As checagens vêm antes de qualquer escrita.
   */
  async execute(userId: ID, id: ID, areaId: ID, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const superTask = await this.superTaskRepository.buscarPorId(userId, id)
    if (!superTask) throw new NotFoundError('Super task')
    if (superTask.concluida) throw new ConflictError(MENSAGEM_SUPER_TASK_CONCLUIDA)

    const destino = await this.areaRepository.buscarPorId(userId, areaId)
    if (!destino) throw new NotFoundError('Área de destino')
    if (destino.sistema) throw new ValidationError('A área Rotina não aceita Super tasks.')

    const filhas = await this.tarefaRepository.listarDasSuperTasks(userId, [id])
    if (superTask.areaId === areaId) return detalharSuperTask(superTask, filhas, agora)

    if (filhas.some((filha) => filha.concluida)) {
      throw new ConflictError('A Super task tem filhas concluídas, que não podem mudar de área: não dá para mover o grupo.')
    }
    const hoje = dataAtual(agora)
    if (filhas.some((filha) => tarefaTravada(filha, hoje))) {
      throw new ConflictError('A Super task tem filhas de um dia que já passou no sprint: elas só podem ser concluídas.')
    }

    const movida = await this.superTaskRepository.mover(userId, id, areaId)
    if (filhas.length > 0) await this.tarefaRepository.moverDaSuperTask(userId, id, areaId)
    return detalharSuperTask(movida, filhas.map((filha) => ({ ...filha, areaId })), agora)
  }
}
