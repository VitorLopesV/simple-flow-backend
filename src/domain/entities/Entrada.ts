import type { ID } from '../../shared/types/common'
import type { ControleDeSerie } from './Recorrencia'

/** Detalhe da entrada, independente da categoria (que é o grupo: Renda Fixa, Renda Variável, Investimentos, Outros). */
export type EntradaTipo = 'SALARIO' | 'FREELANCE' | 'RENDIMENTOS' | 'REEMBOLSO'

export interface Entrada extends ControleDeSerie {
  id: ID
  descricao: string
  /** Valor em BRL, sempre positivo. */
  valor: number
  /** Data de competência no formato ISO `YYYY-MM-DD`. */
  data: string
  categoriaId: ID
  tipo: EntradaTipo
  recorrente: boolean
  observacao?: string | null
  criadoEm: string
  atualizadoEm: string
}

export type EntradaPayload = Omit<Entrada, 'id' | 'criadoEm' | 'atualizadoEm' | keyof ControleDeSerie>

export interface EntradaResumo {
  total: number
  quantidade: number
  media: number
  totalMesAnterior: number
  porCategoria: { categoriaId: ID; nome: string; cor: string; total: number }[]
}
