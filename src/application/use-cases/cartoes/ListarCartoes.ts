import type { Cartao } from '../../../domain/entities/Cartao'
import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { ID } from '../../../shared/types/common'

export class ListarCartoes {
  constructor(private readonly cartaoRepository: CartaoRepository) {}

  execute(userId: ID): Promise<Cartao[]> {
    return this.cartaoRepository.listar(userId)
  }
}
