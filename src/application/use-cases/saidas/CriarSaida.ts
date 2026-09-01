import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { Saida, SaidaPayload } from '../../../domain/entities/Saida'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID } from '../../../shared/types/common'
import { calcularDatasFatura } from '../../../shared/utils/fatura'

/**
 * Ao criar uma saída paga com cartão de crédito, também registra a transação na
 * fatura da competência (criando-a como ABERTA se ainda não existir) — é assim
 * que o total da fatura e a lista de transações do cartão ficam em dia. A saída
 * em si não é marcada `automatica`: quem gera automaticamente é a fatura/transação,
 * não o lançamento de despesa que o próprio usuário registrou.
 */
export class CriarSaida {
  constructor(
    private readonly saidaRepository: SaidaRepository,
    private readonly cartaoRepository: CartaoRepository,
    private readonly faturaRepository: FaturaRepository,
  ) {}

  async execute(userId: ID, payload: SaidaPayload): Promise<Saida> {
    const saida = await this.saidaRepository.criar(userId, payload)

    if (payload.formaPagamento === 'CARTAO_CREDITO' && payload.cartaoId) {
      const cartao = await this.cartaoRepository.buscarPorId(userId, payload.cartaoId)

      if (cartao) {
        const competencia = payload.data.slice(0, 7)
        const { fechamento, vencimento } = calcularDatasFatura(cartao, competencia)

        await this.faturaRepository.registrarTransacao(userId, {
          cartaoId: payload.cartaoId,
          categoriaId: payload.categoriaId,
          descricao: payload.descricao,
          valor: payload.valor,
          data: payload.data,
          competencia,
          fechamento,
          vencimento,
          parcelaAtual: 1,
          totalParcelas: 1,
          recorrente: payload.recorrente,
        })
      }
    }

    return saida
  }
}
