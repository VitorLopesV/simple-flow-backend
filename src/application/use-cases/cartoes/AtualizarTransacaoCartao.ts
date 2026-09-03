import { NotFoundError } from '../../../domain/errors/DomainError'
import type { TransacaoCartao, TransacaoCartaoPayload } from '../../../domain/entities/Fatura'
import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'
import { calcularDatasFatura } from '../../../shared/utils/fatura'

/** Editar a data pode mover o débito para a fatura de outra competência. */
export class AtualizarTransacaoCartao {
  constructor(
    private readonly cartaoRepository: CartaoRepository,
    private readonly faturaRepository: FaturaRepository,
  ) {}

  async execute(userId: ID, id: ID, payload: TransacaoCartaoPayload): Promise<TransacaoCartao> {
    const atual = await this.faturaRepository.buscarTransacaoPorId(userId, id)
    if (!atual) throw new NotFoundError('Transação do cartão')

    const cartao = await this.cartaoRepository.buscarPorId(userId, atual.cartaoId)
    if (!cartao) throw new NotFoundError('Cartão')

    const competencia = payload.data.slice(0, 7)

    return this.faturaRepository.atualizarTransacao(userId, id, payload, {
      competencia,
      ...calcularDatasFatura(cartao, competencia),
    })
  }
}
