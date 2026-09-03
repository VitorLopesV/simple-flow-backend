import { NotFoundError } from '../../../domain/errors/DomainError'
import type { TransacaoCartao, TransacaoCartaoPayload } from '../../../domain/entities/Fatura'
import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'
import { calcularDatasFatura } from '../../../shared/utils/fatura'

/**
 * Lança um débito direto no cartão. A fatura da competência da data é criada como
 * ABERTA se ainda não existir — é ela que soma os débitos e aparece como saída na
 * aba Saídas.
 */
export class CriarTransacaoCartao {
  constructor(
    private readonly cartaoRepository: CartaoRepository,
    private readonly faturaRepository: FaturaRepository,
  ) {}

  async execute(userId: ID, cartaoId: ID, payload: TransacaoCartaoPayload): Promise<TransacaoCartao> {
    const cartao = await this.cartaoRepository.buscarPorId(userId, cartaoId)
    if (!cartao) throw new NotFoundError('Cartão')

    const competencia = payload.data.slice(0, 7)

    return this.faturaRepository.criarTransacao(userId, cartaoId, payload, {
      competencia,
      ...calcularDatasFatura(cartao, competencia),
    })
  }
}
