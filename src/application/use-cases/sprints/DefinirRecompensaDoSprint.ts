import { ConflictError } from '../../../domain/errors/DomainError'
import type { RecompensaPadraoRepository } from '../../../domain/repositories/RecompensaPadraoRepository'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import { recompensaEfetiva } from '../../../domain/services/fotoDoSprint'
import type { ID } from '../../../shared/types/common'
import type { AlvoDoSprint, ObterSprint } from './ObterSprint'

export const MENSAGEM_RECOMPENSA_DE_SPRINT_FECHADO = 'O sprint já foi fechado: a recompensa dele não pode mais ser alterada.'

export interface RecompensaDoSprint {
  sprintId: ID
  inicio: string
  fim: string
  /** A definida para este sprint; nula = usa a padrão. */
  recompensa: string | null
  recompensaPadrao: string | null
  /** A que vale: a do sprint ou, na falta, a padrão. */
  recompensaEfetiva: string | null
}

/**
 * Define a recompensa de um sprint ainda não fechado (no domingo, a do PRÓXIMO, durante o planejamento).
 * Sprint fechado é imutável: 409. A recompensa só vale no fechamento (a foto grava a efetiva naquele instante).
 */
export class DefinirRecompensaDoSprint {
  constructor(
    private readonly obterSprint: Pick<ObterSprint, 'execute'>,
    private readonly sprintRepository: SprintRepository,
    private readonly padraoRepository: RecompensaPadraoRepository,
  ) {}

  async execute(userId: ID, alvo: AlvoDoSprint, recompensa: string | null, agora: Date = new Date()): Promise<RecompensaDoSprint> {
    // Passa pela reserva do fechamento: um sprint vencido é fechado antes de a recompensa ser avaliada.
    const { sprint } = await this.obterSprint.execute(userId, alvo, agora)
    if (sprint.situacao === 'FECHADO') throw new ConflictError(MENSAGEM_RECOMPENSA_DE_SPRINT_FECHADO)

    const gravou = await this.sprintRepository.definirRecompensa(userId, sprint.id, recompensa)
    if (!gravou) throw new ConflictError(MENSAGEM_RECOMPENSA_DE_SPRINT_FECHADO)

    const padrao = await this.padraoRepository.obter(userId)
    return {
      sprintId: sprint.id,
      inicio: sprint.inicio,
      fim: sprint.fim,
      recompensa,
      recompensaPadrao: padrao,
      recompensaEfetiva: recompensaEfetiva(recompensa, padrao),
    }
  }
}
