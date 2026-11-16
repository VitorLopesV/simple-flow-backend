import type { ItemRotina, ItemRotinaPayload } from '../../../domain/entities/ItemRotina'
import { NotFoundError } from '../../../domain/errors/DomainError'
import type { ItemRotinaRepository } from '../../../domain/repositories/ItemRotinaRepository'
import type { ID } from '../../../shared/types/common'

export class AtualizarItemRotina {
  constructor(private readonly itemRotinaRepository: ItemRotinaRepository) {}

  async execute(userId: ID, id: ID, payload: ItemRotinaPayload): Promise<ItemRotina> {
    if (!(await this.itemRotinaRepository.buscarPorId(userId, id))) throw new NotFoundError('Item de rotina')
    return this.itemRotinaRepository.atualizar(userId, id, payload)
  }
}
