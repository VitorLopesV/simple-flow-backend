import type { ID } from '../../shared/types/common'

export type SaidaStatus = 'PAGO' | 'PENDENTE'
export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'BOLETO' | 'CARTAO_CREDITO'

export interface Saida {
  id: ID
  descricao: string
  /** Valor em BRL, sempre positivo. */
  valor: number
  /** Data de competência no formato ISO `YYYY-MM-DD`. */
  data: string
  categoriaId: ID
  status: SaidaStatus
  formaPagamento: FormaPagamento
  /** Preenchido quando `formaPagamento === 'CARTAO_CREDITO'`. */
  cartaoId?: ID | null
  recorrente: boolean
  observacao?: string | null
  criadoEm: string
  atualizadoEm: string
  /** true = gerada automaticamente a partir da fatura de um cartão (não editável/removível diretamente). */
  automatica: boolean
}

export type SaidaPayload = Omit<Saida, 'id' | 'criadoEm' | 'atualizadoEm' | 'automatica'>

export interface SaidaResumo {
  total: number
  quantidade: number
  media: number
  totalPago: number
  totalPendente: number
  totalMesAnterior: number
  porCategoria: { categoriaId: ID; nome: string; cor: string; total: number }[]
}
