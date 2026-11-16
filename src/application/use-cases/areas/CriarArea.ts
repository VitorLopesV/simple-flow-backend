import type { Area, AreaPayload } from '../../../domain/entities/Area'
import { ConflictError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { ID } from '../../../shared/types/common'

export class CriarArea {
  constructor(private readonly areaRepository: AreaRepository) {}

  async execute(userId: ID, payload: AreaPayload): Promise<Area> {
    if (await this.areaRepository.buscarPorNome(userId, payload.nome)) {
      throw new ConflictError('Já existe uma área com esse nome.')
    }
    return this.areaRepository.criar(userId, payload)
  }
}
