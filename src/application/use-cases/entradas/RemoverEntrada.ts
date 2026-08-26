import type { EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID } from '../../../shared/types/common'

export class RemoverEntrada {
  constructor(private readonly entradaRepository: EntradaRepository) {}

  execute(userId: ID, id: ID): Promise<void> {
    return this.entradaRepository.remover(userId, id)
  }
}
