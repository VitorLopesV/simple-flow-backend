import type { FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'

export class RemoverTransacaoCartao {
  constructor(private readonly faturaRepository: FaturaRepository) {}

  execute(userId: ID, id: ID): Promise<void> {
    return this.faturaRepository.removerTransacao(userId, id)
  }
}
