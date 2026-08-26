import { ConflictError, NotFoundError } from '../../../domain/errors/DomainError'
import type { Saida, SaidaPayload } from '../../../domain/entities/Saida'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID } from '../../../shared/types/common'

export class AtualizarSaida {
  constructor(private readonly saidaRepository: SaidaRepository) {}

  async execute(userId: ID, id: ID, payload: SaidaPayload): Promise<Saida> {
    const atual = await this.saidaRepository.buscarPorId(userId, id)
    if (!atual) throw new NotFoundError('Saída')
    if (atual.automatica) {
      throw new ConflictError(
        'Esta saída foi gerada automaticamente pela fatura do cartão e não pode ser editada diretamente.',
      )
    }

    return this.saidaRepository.atualizar(userId, id, payload)
  }
}
