import type { ID } from '../../shared/types/common'

export interface NavegacaoRepository {
  /** Data (ISO) do registro mais antigo do usuário entre entradas, saídas e transações de cartão; null sem dados. */
  primeiraDataComDados(userId: ID): Promise<string | null>
}
