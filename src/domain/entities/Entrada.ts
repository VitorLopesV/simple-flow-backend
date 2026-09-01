import type { ID } from '../../shared/types/common'

export interface Entrada {
  id: ID
  descricao: string
  /** Valor em BRL, sempre positivo. */
  valor: number
  /** Data de competência no formato ISO `YYYY-MM-DD`. */
  data: string
  categoriaId: ID
  recorrente: boolean
  observacao?: string | null
  criadoEm: string
  atualizadoEm: string
  /**
   * Preenchido só nas ocorrências futuras projetadas a partir de um lançamento
   * recorrente (ver `shared/utils/recorrencia.ts`) — nunca persistido, recalculado
   * a cada leitura. Editável apenas pelo lançamento original.
   */
  origemRecorrenciaId?: ID
}

export type EntradaPayload = Omit<Entrada, 'id' | 'criadoEm' | 'atualizadoEm'>

export interface EntradaResumo {
  total: number
  quantidade: number
  media: number
  totalMesAnterior: number
  porCategoria: { categoriaId: ID; nome: string; cor: string; total: number }[]
}
