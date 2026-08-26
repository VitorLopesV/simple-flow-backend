import type { Entrada, EntradaPayload } from '../../../domain/entities/Entrada'
import type { EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID } from '../../../shared/types/common'

export class AtualizarEntrada {
  constructor(private readonly entradaRepository: EntradaRepository) {}

  execute(userId: ID, id: ID, payload: EntradaPayload): Promise<Entrada> {
    return this.entradaRepository.atualizar(userId, id, payload)
  }
}
