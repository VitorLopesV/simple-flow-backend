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
  placar: PlacarDoSprint
}

export class ObterPlacarDoSprint {
  constructor(
    private readonly obterSprint: Pick<ObterSprint, 'execute'>,
    private readonly tarefasRepository: TarefasDoSprintRepository,
  ) {}

  /** Placar ao vivo: recalculado a cada leitura, então acompanha tarefas que entram e saem. */
  async execute(userId: ID, alvo: AlvoDoSprint, agora: Date = new Date()): Promise<PlacarComSprint> {
    const { sprint, iniciado, previa, ocorrencias } = await this.obterSprint.execute(userId, alvo, agora)
    const tarefas = await this.tarefasRepository.listar(userId, sprint.id, sprint.inicio, sprint.fim)
    return {
      sprintId: sprint.id,
      inicio: sprint.inicio,
      fim: sprint.fim,
      iniciado,
      previa,
      placar: calcularPlacar(ocorrencias, tarefas, sprint.inicio, sprint.fim),
    }
  }
}
