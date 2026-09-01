import type { CartaoComFatura, FaturaFiltro } from '../entities/Fatura'
import type { ID } from '../../shared/types/common'

export interface RegistrarTransacaoParams {
  cartaoId: ID
  categoriaId: ID
  descricao: string
  valor: number
  data: string
  /** Competência (YYYY-MM) da fatura à qual a transação pertence. */
  competencia: string
  /** Datas já calculadas pelo caller (regra de negócio fica na use-case, não no repositório). */
  fechamento: string
  vencimento: string
  parcelaAtual: number
  totalParcelas: number
  recorrente: boolean
}

export interface FaturaRepository {
  listarComFaturas(userId: ID, filtro: FaturaFiltro): Promise<CartaoComFatura[]>
  pagar(userId: ID, faturaId: ID): Promise<void>
  /** Faz upsert da fatura da competência (criando-a como ABERTA se não existir) e insere a transação. */
  registrarTransacao(userId: ID, params: RegistrarTransacaoParams): Promise<void>
}
