import { ValidationError } from '../../../domain/errors/DomainError'
import type { NavegacaoRepository } from '../../../domain/repositories/NavegacaoRepository'
import type { ID } from '../../../shared/types/common'
import { ObterLimitesNavegacao } from './ObterLimitesNavegacao'

/** Rejeita (422) competência fora dos limites de navegação do usuário. */
export class ValidarCompetencia {
  private readonly obterLimites: ObterLimitesNavegacao

  constructor(navegacaoRepository: NavegacaoRepository, agora?: () => Date) {
    this.obterLimites = new ObterLimitesNavegacao(navegacaoRepository, agora)
  }

  async execute(userId: ID, competencia: string): Promise<void> {
    const { primeiroMes, ultimoMes } = await this.obterLimites.execute(userId)
    if (competencia < primeiroMes || competencia > ultimoMes) {
      throw new ValidationError(`Competência fora do intervalo permitido (${primeiroMes} a ${ultimoMes}).`)
    }
  }
}
