import type { ID } from '../../shared/types/common'

export type CategoriaTipo = 'CONTA_FIXA' | 'CONTA_VARIAVEL' | 'RENDA' | 'INVESTIMENTO'
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
