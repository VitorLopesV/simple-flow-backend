import type { Saida, SaidaPayload } from '../../../domain/entities/Saida'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID } from '../../../shared/types/common'

/**
 * Gasto no cartão de crédito não passa por aqui: ele é lançado direto no cartão
 * (ver `CriarTransacaoCartao`) e chega na aba Saídas como a fatura inteira, uma
 * saída derivada (ver `SupabaseSaidaRepository.listarComProjecao`). Por isso o
 * schema da rota não aceita `formaPagamento: 'CARTAO_CREDITO'`.
 */
export class CriarSaida {
  constructor(private readonly saidaRepository: SaidaRepository) {}

  execute(userId: ID, payload: SaidaPayload): Promise<Saida> {
    return this.saidaRepository.criar(userId, payload)
  }
}
