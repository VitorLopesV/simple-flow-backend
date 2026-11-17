import type { PlacarDoSprint } from '../../../domain/entities/PlacarDoSprint'
import type { TarefasDoSprintRepository } from '../../../domain/repositories/TarefasDoSprintRepository'
import { calcularPlacar } from '../../../domain/services/placarDoSprint'
import type { ID } from '../../../shared/types/common'
import type { AlvoDoSprint, ObterSprint } from './ObterSprint'

export interface PlacarComSprint {
  sprintId: ID
  inicio: string
  fim: string
  iniciado: boolean
  /** Sprint ainda não começou: rotina calculada da configuração atual. */
  previa: boolean
  /** Sprint fechado: `placar` é a foto gravada no fechamento (imutável), não um cálculo ao vivo. */
  fechado: boolean
  fechadoEm: string | null
  placar: PlacarDoSprint
}

export class ObterPlacarDoSprint {
  constructor(
    private readonly obterSprint: Pick<ObterSprint, 'execute'>,
    private readonly tarefasRepository: TarefasDoSprintRepository,
  ) {}

  /** Placar ao vivo enquanto o sprint está aberto; depois do fechamento, devolve a foto gravada. */
  async execute(userId: ID, alvo: AlvoDoSprint, agora: Date = new Date()): Promise<PlacarComSprint> {
    const { sprint, iniciado, previa, ocorrencias } = await this.obterSprint.execute(userId, alvo, agora)
    if (sprint.situacao === 'FECHADO' && sprint.foto) {
      return {
        sprintId: sprint.id,
        inicio: sprint.inicio,
        fim: sprint.fim,
        iniciado,
        previa,
        fechado: true,
        fechadoEm: sprint.fechadoEm,
        placar: sprint.foto,
      }
    }
    const tarefas = await this.tarefasRepository.listar(userId, sprint.id, sprint.inicio, sprint.fim)
    return {
      sprintId: sprint.id,
      inicio: sprint.inicio,
      fim: sprint.fim,
      iniciado,
      previa,
      fechado: false,
      fechadoEm: null,
      placar: calcularPlacar(ocorrencias, tarefas, sprint.inicio, sprint.fim),
    }
  }
}
