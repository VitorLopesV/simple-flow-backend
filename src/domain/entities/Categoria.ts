import type { ID } from '../../shared/types/common'

/**
 * Natureza da categoria. Saídas: Despesa Fixa (CONTA_FIXA), Despesa Variável
 * (CONTA_VARIAVEL) e Investimento. Entradas: Renda Fixa, Renda Variável,
 * Investimentos (INVESTIMENTO) e Outros.
 */
export type CategoriaTipo =
  | 'CONTA_FIXA'
  | 'CONTA_VARIAVEL'
  | 'RENDA_FIXA'
  | 'RENDA_VARIAVEL'
  | 'INVESTIMENTO'
  | 'OUTROS'
export type Movimento = 'ENTRADA' | 'SAIDA'

export interface Categoria {
  id: ID
  nome: string
  tipo: CategoriaTipo
  movimento: Movimento
  cor: string
  /** null = categoria padrão do sistema, visível a todos os usuários. */
  userId: ID | null
}
