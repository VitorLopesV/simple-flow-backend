import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { ID } from '../../../shared/types/common'

export class RemoverCartao {
  constructor(private readonly cartaoRepository: CartaoRepository) {}

  execute(userId: ID, id: ID): Promise<void> {
    return this.cartaoRepository.remover(userId, id)
  }
}
