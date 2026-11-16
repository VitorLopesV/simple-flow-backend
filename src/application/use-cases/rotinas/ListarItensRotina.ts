import type { ItemRotina } from '../../../domain/entities/ItemRotina'
import type { ItemRotinaRepository } from '../../../domain/repositories/ItemRotinaRepository'
import type { ID } from '../../../shared/types/common'

export class ListarItensRotina {
  constructor(private readonly itemRotinaRepository: ItemRotinaRepository) {}

  execute(userId: ID): Promise<ItemRotina[]> {
    return this.itemRotinaRepository.listar(userId)
  }
}
