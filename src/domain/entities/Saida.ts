import type { ID } from '../../shared/types/common'

export type SaidaStatus = 'PAGO' | 'PENDENTE'
export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'BOLETO' | 'CARTAO_CREDITO'

/** Classificação específica da despesa, independente da categoria (fixa/variável/investimento). */
export type SaidaTipo =
  | 'TRANSPORTE'
  | 'ALIMENTACAO'
  | 'LAZER'
  | 'CONTA'
  | 'POUPANCA'
  | 'ACOES'
  | 'OUTROS'

export interface Saida {
  id: ID
  descricao: string
  /** Valor em BRL, sempre positivo. */
  valor: number
  /** Data de competência no formato ISO `YYYY-MM-DD`. */
  data: string
  categoriaId: ID
  tipo: SaidaTipo
  status: SaidaStatus
  /** Data de vencimento da conta, formato ISO `YYYY-MM-DD`. Opcional: nem toda saída tem vencimento marcado. */
  vencimento?: string | null
  /**
   * Data em que a conta foi de fato paga, formato ISO `YYYY-MM-DD`. Nunca vem do
   * payload do cliente — é definida pela aplicação quando `status` muda para
   * 'PAGO' e limpa quando volta para 'PENDENTE' (ver `CriarSaida`/`AtualizarSaida`).
   */
  pagoEm?: string | null
  formaPagamento: FormaPagamento
  /** Preenchido quando `formaPagamento === 'CARTAO_CREDITO'`. */
  cartaoId?: ID | null
  recorrente: boolean
  observacao?: string | null
  criadoEm: string
  atualizadoEm: string
  /** true = gerada automaticamente a partir da fatura de um cartão (não editável/removível diretamente). */
  automatica: boolean
  /**
   * Preenchido só nas ocorrências futuras projetadas a partir de um lançamento
   * recorrente (ver `shared/utils/recorrencia.ts`) — nunca persistido, recalculado
   * a cada leitura. Editar uma dessas ocorrências (ver `AtualizarSaida`) materializa
   * uma linha própria para aquele mês, independente do original em situação, data
   * de pagamento e valor.
   */
  origemRecorrenciaId?: ID
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
