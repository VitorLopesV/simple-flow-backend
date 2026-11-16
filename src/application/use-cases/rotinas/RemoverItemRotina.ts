import { NotFoundError } from '../../../domain/errors/DomainError'
import type { ItemRotinaRepository } from '../../../domain/repositories/ItemRotinaRepository'
import type { ID } from '../../../shared/types/common'

export class RemoverItemRotina {
  constructor(private readonly itemRotinaRepository: ItemRotinaRepository) {}

  async execute(userId: ID, id: ID): Promise<void> {
    if (!(await this.itemRotinaRepository.buscarPorId(userId, id))) throw new NotFoundError('Item de rotina')
    await this.itemRotinaRepository.remover(userId, id)
  }
}
