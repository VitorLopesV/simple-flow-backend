import type { DestinoDasTarefas } from '../../../domain/entities/Area'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { ID } from '../../../shared/types/common'

export class RemoverArea {
  constructor(private readonly areaRepository: AreaRepository) {}

  /**
   * Área com tarefas só sai com uma escolha explícita (`destino`): mover as tarefas para
   * outra área ou excluí-las junto. As checagens vêm antes de qualquer escrita.
   */
  async execute(userId: ID, id: ID, destino?: DestinoDasTarefas): Promise<void> {
    const area = await this.areaRepository.buscarPorId(userId, id)
    if (!area) throw new NotFoundError('Área')
    if (area.sistema) throw new ConflictError('A área Rotina não pode ser excluída.')

    const totalTarefas = await this.areaRepository.contarTarefas(userId, id)
    if (totalTarefas === 0) {
      await this.areaRepository.remover(userId, id)
      return
    }

    if (!destino) {
      throw new ConflictError('A área tem tarefas: escolha movê-las para outra área ou excluí-las junto.')
    }

    if (destino.acao === 'EXCLUIR') {
      await this.areaRepository.removerTarefas(userId, id)
      await this.areaRepository.remover(userId, id)
      return
    }

    if (destino.areaDestinoId === id) throw new ValidationError('Escolha uma área de destino diferente da excluída.')
    const areaDestino = await this.areaRepository.buscarPorId(userId, destino.areaDestinoId)
    if (!areaDestino) throw new NotFoundError('Área de destino')
    // A Rotina só guarda itens de rotina, nunca tarefas comuns.
    if (areaDestino.sistema) throw new ValidationError('A área Rotina não aceita tarefas.')

    await this.areaRepository.moverTarefas(userId, id, areaDestino.id)
    await this.areaRepository.remover(userId, id)
  }
}
