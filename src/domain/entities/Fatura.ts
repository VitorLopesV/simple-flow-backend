import type { ID, Periodo } from '../../shared/types/common'
import type { SaidaTipo } from './Saida'
import type { Cartao } from './Cartao'
import type { ControleDeSerie } from './Recorrencia'

export type FaturaStatus = 'ABERTA' | 'FECHADA' | 'PAGA' | 'ATRASADA'

/**
 * Débito lançado direto no cartão — mesmo formato de uma `Saida`, sem forma de
 * pagamento (é sempre o cartão) e sem situação própria (quem é paga é a fatura).
 */
export interface TransacaoCartao extends ControleDeSerie {
  id: ID
  cartaoId: ID
  faturaId: ID
  descricao: string
  valor: number
  data: string
  categoriaId: ID
  tipo: SaidaTipo
  parcelaAtual: number
  totalParcelas: number
  recorrente: boolean
  observacao?: string | null
  criadoEm: string
  atualizadoEm: string
}

export type TransacaoCartaoPayload = Omit<
  TransacaoCartao,
  'id' | 'cartaoId' | 'faturaId' | 'criadoEm' | 'atualizadoEm' | keyof ControleDeSerie
>

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
