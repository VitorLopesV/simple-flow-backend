import type { ID } from '../../shared/types/common'

/** Recompensa padrão do usuário (#72): vale para todo sprint que não tiver uma recompensa própria. */
export interface RecompensaPadraoRepository {
  obter(userId: ID): Promise<string | null>
  /** `null` limpa a recompensa padrão. */
  definir(userId: ID, recompensa: string | null): Promise<string | null>
}
