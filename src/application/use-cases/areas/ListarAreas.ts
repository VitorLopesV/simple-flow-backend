import type { Area } from '../../../domain/entities/Area'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { ID } from '../../../shared/types/common'

export class ListarAreas {
  constructor(private readonly areaRepository: AreaRepository) {}

  execute(userId: ID): Promise<Area[]> {
    return this.areaRepository.listar(userId)
  }
}
