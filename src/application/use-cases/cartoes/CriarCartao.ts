import type { Cartao, CartaoPayload } from '../../../domain/entities/Cartao'
import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { ID } from '../../../shared/types/common'

export class CriarCartao {
  constructor(private readonly cartaoRepository: CartaoRepository) {}

  execute(userId: ID, payload: CartaoPayload): Promise<Cartao> {
    return this.cartaoRepository.criar(userId, payload)
  }
}
