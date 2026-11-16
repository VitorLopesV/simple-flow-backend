import type { SuperTaskDetalhada, SuperTaskPayload } from '../../../domain/entities/SuperTask'
import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { ID } from '../../../shared/types/common'
import { detalharSuperTask } from './detalharSuperTask'

export class CriarSuperTask {
  constructor(
    private readonly superTaskRepository: SuperTaskRepository,
    private readonly areaRepository: AreaRepository,
  ) {}

  async execute(userId: ID, payload: SuperTaskPayload, agora: Date = new Date()): Promise<SuperTaskDetalhada> {
    const area = await this.areaRepository.buscarPorId(userId, payload.areaId)
    if (!area) throw new NotFoundError('Área')
    // A Super task não existe na Rotina.
    if (area.sistema) throw new ValidationError('A área Rotina não aceita Super tasks.')

    const superTask = await this.superTaskRepository.criar(userId, payload)
    return detalharSuperTask(superTask, [], agora)
  }
}
