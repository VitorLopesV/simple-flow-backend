import type { Cartao, CartaoPayload } from '../../../domain/entities/Cartao'
import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { ID } from '../../../shared/types/common'

export class AtualizarCartao {
  constructor(private readonly cartaoRepository: CartaoRepository) {}

  execute(userId: ID, id: ID, payload: CartaoPayload): Promise<Cartao> {
    return this.cartaoRepository.atualizar(userId, id, payload)
  }
}
