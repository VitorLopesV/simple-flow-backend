import { randomUUID } from 'node:crypto'

import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { Cartao } from '../../../domain/entities/Cartao'
import type { TransacaoCartao, TransacaoCartaoPayload } from '../../../domain/entities/Fatura'
import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { DatasDaFatura, FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'
import { calcularDatasFatura } from '../../../shared/utils/fatura'
import { categoriaPermiteRecorrencia, mesmoDiaNoMesSeguinte } from '../../../shared/utils/recorrencia'
import { MENSAGEM_RECORRENCIA_SAIDA } from '../saidas/CriarSaida'

/** Fatura (competência + datas) à qual um débito com esta data pertence. */
export function datasDaFatura(cartao: Pick<Cartao, 'diaFechamento' | 'diaVencimento'>, data: string): DatasDaFatura {
  const competencia = data.slice(0, 7)
  return { competencia, ...calcularDatasFatura(cartao, competencia) }
}

/**
 * Lança um débito direto no cartão. A fatura da competência da data é criada como
 * ABERTA se ainda não existir — é ela que soma os débitos e aparece como saída na
 * aba Saídas.
 *
 * Débito recorrente nasce com o do mês seguinte já lançado na fatura do mês seguinte
 * (criada se preciso) — é assim que a recorrência do cartão chega na aba Saídas e no
 * dashboard, como parte de uma fatura real.
 */
export class CriarTransacaoCartao {
  constructor(
    private readonly cartaoRepository: CartaoRepository,
    private readonly faturaRepository: FaturaRepository,
    private readonly categoriaRepository: CategoriaRepository,
  ) {}

  async execute(userId: ID, cartaoId: ID, payload: TransacaoCartaoPayload): Promise<TransacaoCartao> {
    const cartao = await this.cartaoRepository.buscarPorId(userId, cartaoId)
    if (!cartao) throw new NotFoundError('Cartão')

    const categoria = await this.categoriaRepository.buscarPorId(userId, payload.categoriaId)
    if (categoria?.movimento !== 'SAIDA') throw new ValidationError('Categoria inválida.')
    if (payload.recorrente && !categoriaPermiteRecorrencia(categoria)) {
      throw new ValidationError(MENSAGEM_RECORRENCIA_SAIDA)
    }

    if (!payload.recorrente) {
      return this.faturaRepository.criarTransacao(userId, cartaoId, payload, datasDaFatura(cartao, payload.data))
    }

    const serieId = randomUUID()
    const transacao = await this.faturaRepository.criarTransacao(
      userId,
      cartaoId,
      payload,
      datasDaFatura(cartao, payload.data),
      { serieId },
    )
    const dataSeguinte = mesmoDiaNoMesSeguinte(payload.data)
    await this.faturaRepository.criarTransacao(
      userId,
      cartaoId,
      { ...payload, data: dataSeguinte },
      datasDaFatura(cartao, dataSeguinte),
      { serieId },
    )
    return transacao
  }
}
