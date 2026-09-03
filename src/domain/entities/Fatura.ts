import type { ID, Periodo } from '../../shared/types/common'
import type { SaidaTipo } from './Saida'
import type { Cartao } from './Cartao'

export type FaturaStatus = 'ABERTA' | 'FECHADA' | 'PAGA' | 'ATRASADA'

/**
 * Débito lançado direto no cartão — mesmo formato de uma `Saida`, sem forma de
 * pagamento (é sempre o cartão) e sem situação própria (quem é paga é a fatura).
 */
export interface TransacaoCartao {
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
  /**
   * Preenchido só nas ocorrências futuras projetadas a partir de uma transação
   * recorrente (ver `shared/utils/recorrencia.ts`) — nunca persistido, recalculado
   * a cada leitura, e a fatura a que pertence pode ser virtual (ver `Fatura.id`).
   */
  origemRecorrenciaId?: ID
}

export type TransacaoCartaoPayload = Omit<
  TransacaoCartao,
  'id' | 'cartaoId' | 'faturaId' | 'criadoEm' | 'atualizadoEm' | 'origemRecorrenciaId'
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
