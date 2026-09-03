import type {
  CartaoComFatura,
  FaturaFiltro,
  TransacaoCartao,
  TransacaoCartaoPayload,
} from '../entities/Fatura'
import type { ID, Periodo } from '../../shared/types/common'

/**
 * Fatura que vence dentro de um período, já com o total consolidado — é a forma
 * como o cartão aparece na aba Saídas (uma saída derivada por fatura, ver
 * `SupabaseSaidaRepository.listarComProjecao`).
 */
export interface FaturaComoSaida {
  faturaId: ID
  cartaoId: ID
  cartaoNome: string
  categoriaId: ID
  vencimento: string
  total: number
  paga: boolean
}

export interface DatasDaFatura {
  /** Competência (YYYY-MM) da fatura à qual a transação pertence. */
  competencia: string
  /** Datas já calculadas pelo caller (regra de negócio fica na use-case, não no repositório). */
  fechamento: string
  vencimento: string
}

export interface FaturaRepository {
  listarComFaturas(userId: ID, filtro: FaturaFiltro): Promise<CartaoComFatura[]>
  /** Faturas que vencem no período — cada uma vira uma saída derivada na aba Saídas. */
  listarVencendoNoPeriodo(userId: ID, periodo: Periodo): Promise<FaturaComoSaida[]>
  pagar(userId: ID, faturaId: ID): Promise<void>
  buscarTransacaoPorId(userId: ID, id: ID): Promise<TransacaoCartao | null>
  /** Faz upsert da fatura da competência (criando-a como ABERTA se não existir) e insere a transação. */
  criarTransacao(
    userId: ID,
    cartaoId: ID,
    payload: TransacaoCartaoPayload,
    datas: DatasDaFatura,
  ): Promise<TransacaoCartao>
  /** Move a transação para a fatura da nova competência quando a data muda de mês. */
  atualizarTransacao(
    userId: ID,
    id: ID,
    payload: TransacaoCartaoPayload,
    datas: DatasDaFatura,
  ): Promise<TransacaoCartao>
  removerTransacao(userId: ID, id: ID): Promise<void>
}
