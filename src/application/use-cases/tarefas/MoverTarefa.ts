import type { Tarefa } from '../../../domain/entities/Tarefa'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_TRAVADA, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
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
    if (tarefaTravada(tarefa, dataAtual(agora))) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)

    const destino = await this.areaRepository.buscarPorId(userId, areaId)
    if (!destino) throw new NotFoundError('Área de destino')
    if (destino.sistema) throw new ValidationError('A área Rotina não aceita tarefas.')

    const origem = await this.areaRepository.buscarPorId(userId, tarefa.areaId)
    if (origem?.sistema) throw new ValidationError('Tarefas não podem sair da área Rotina.')

    if (tarefa.areaId === areaId) return tarefa
    return this.tarefaRepository.mover(userId, id, areaId)
  }
}
