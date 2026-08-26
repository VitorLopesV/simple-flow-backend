import type { FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'

export class PagarFatura {
  constructor(private readonly faturaRepository: FaturaRepository) {}

  execute(userId: ID, faturaId: ID): Promise<void> {
    return this.faturaRepository.pagar(userId, faturaId)
  }
}
