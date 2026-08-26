import type { ID } from '../../shared/types/common'

export type Bandeira = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD'

export interface Cartao {
  id: ID
  nome: string
  bandeira: Bandeira
  /** Últimos 4 dígitos — nunca armazenamos o número completo. */
  ultimosDigitos: string
  limite: number
  /** Dia do mês em que a fatura fecha (1-28). */
  diaFechamento: number
  /** Dia do mês de vencimento da fatura (1-28). */
  diaVencimento: number
  cor: string
  ativo: boolean
  criadoEm: string
}

export type CartaoPayload = Omit<Cartao, 'id' | 'criadoEm'>
