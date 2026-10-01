import type { LimitesNavegacao } from '../../../domain/entities/Navegacao'
import type { NavegacaoRepository } from '../../../domain/repositories/NavegacaoRepository'
import type { ID } from '../../../shared/types/common'
import { addMeses, competenciaAtual, paraCompetencia, paraPeriodo } from '../../../shared/utils/periodo'

/**
 * Até onde o usuário pode navegar: do primeiro mês com dados até o mês atual + 1.
 * O "agora" é injetável para que a regra dinâmica (avança sozinha na virada do mês)
 * seja testável.
 */
export class ObterLimitesNavegacao {
  constructor(
    private readonly navegacaoRepository: NavegacaoRepository,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  async execute(userId: ID): Promise<LimitesNavegacao> {
    const mesAtual = competenciaAtual(this.agora())
    const primeiraData = await this.navegacaoRepository.primeiraDataComDados(userId)
    const primeiroComDados = primeiraData?.slice(0, 7)

    return {
      // Dado só no futuro (ex.: o mês seguinte de uma recorrência) não puxa o limite para frente.
      primeiroMes: primeiroComDados && primeiroComDados < mesAtual ? primeiroComDados : mesAtual,
      ultimoMes: paraCompetencia(addMeses(paraPeriodo(mesAtual), 1)),
    }
  }
}
