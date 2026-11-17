import type { RecompensaPadraoRepository } from '../../../domain/repositories/RecompensaPadraoRepository'
import type { ID } from '../../../shared/types/common'

export interface RecompensaPadraoResposta {
  recompensaPadrao: string | null
}

export class ObterRecompensaPadrao {
  constructor(private readonly repository: RecompensaPadraoRepository) {}

  async execute(userId: ID): Promise<RecompensaPadraoResposta> {
    return { recompensaPadrao: await this.repository.obter(userId) }
  }
}

export class DefinirRecompensaPadrao {
  constructor(private readonly repository: RecompensaPadraoRepository) {}

  /** `null` limpa a recompensa padrão (o schema já aparou o texto e trocou vazio por `null`). */
  async execute(userId: ID, recompensa: string | null): Promise<RecompensaPadraoResposta> {
    return { recompensaPadrao: await this.repository.definir(userId, recompensa) }
  }
}
