import type { Tarefa } from '../../../domain/entities/Tarefa'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA, MENSAGEM_TAREFA_TRAVADA, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'

export class MoverTarefa {
  constructor(
    private readonly tarefaRepository: TarefaRepository,
    private readonly areaRepository: AreaRepository,
  ) {}

  /** Recusa mover para a Rotina ou a partir dela: tarefa e item de rotina não se misturam. */
  async execute(userId: ID, id: ID, areaId: ID, agora: Date = new Date()): Promise<Tarefa> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, id)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)
    if (tarefaTravada(tarefa, dataAtual(agora))) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
    // A filha fica na área da Super task; para mudar, mova a Super task (leva as filhas) ou retire a filha dela.
    if (tarefa.superTaskId && tarefa.areaId !== areaId) {
      throw new ConflictError('Esta tarefa é filha de uma Super task: mova a Super task ou retire a tarefa dela antes de mudar de área.')
    }

    const destino = await this.areaRepository.buscarPorId(userId, areaId)
    if (!destino) throw new NotFoundError('Área de destino')
    if (destino.sistema) throw new ValidationError('A área Rotina não aceita tarefas.')

    const origem = await this.areaRepository.buscarPorId(userId, tarefa.areaId)
    if (origem?.sistema) throw new ValidationError('Tarefas não podem sair da área Rotina.')

    if (tarefa.areaId === areaId) return tarefa
    return this.tarefaRepository.mover(userId, id, areaId)
  }
}
