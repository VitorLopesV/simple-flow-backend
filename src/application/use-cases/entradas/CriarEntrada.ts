import type { Entrada, EntradaPayload } from '../../../domain/entities/Entrada'
import type { EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID } from '../../../shared/types/common'

export class CriarEntrada {
  constructor(private readonly entradaRepository: EntradaRepository) {}

  execute(userId: ID, payload: EntradaPayload): Promise<Entrada> {
    return this.entradaRepository.criar(userId, payload)
  }
}
