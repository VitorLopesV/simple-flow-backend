import type { ID, Periodo } from '../../shared/types/common'
import type { Cartao } from './Cartao'

export type FaturaStatus = 'ABERTA' | 'FECHADA' | 'PAGA' | 'ATRASADA'

export interface TransacaoCartao {
  id: ID
  cartaoId: ID
  faturaId: ID
  descricao: string
  valor: number
  data: string
  categoriaId: ID
  parcelaAtual: number
  totalParcelas: number
}

export interface Fatura {
  id: ID
  cartaoId: ID
  /** Competência no formato `YYYY-MM`. */
  competencia: string
  fechamento: string
  vencimento: string
  total: number
  status: FaturaStatus
  pagoEm?: string | null
}

export interface FaturaDetalhada extends Fatura {
  transacoes: TransacaoCartao[]
}

export interface CartaoComFatura {
  cartao: Cartao
  fatura: FaturaDetalhada | null
  /** Percentual do limite comprometido pela fatura em aberto (0-100). */
  usoLimite: number
}

export interface FaturaFiltro {
  cartaoId?: ID | null
  periodo: Periodo
}
