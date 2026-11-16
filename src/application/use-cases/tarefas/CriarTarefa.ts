import type { Tarefa, TarefaPayload } from '../../../domain/entities/Tarefa'
import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { ID } from '../../../shared/types/common'

export class CriarTarefa {
  constructor(
    private readonly tarefaRepository: TarefaRepository,
    private readonly areaRepository: AreaRepository,
  ) {}

  async execute(userId: ID, payload: TarefaPayload): Promise<Tarefa> {
    const area = await this.areaRepository.buscarPorId(userId, payload.areaId)
    if (!area) throw new NotFoundError('Área')
    // A Rotina só guarda itens de rotina, nunca tarefas comuns.
    if (area.sistema) throw new ValidationError('A área Rotina não aceita tarefas.')

    return this.tarefaRepository.criar(userId, payload)
  }
}
