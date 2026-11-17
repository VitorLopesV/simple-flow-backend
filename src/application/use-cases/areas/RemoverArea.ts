import type { DestinoDasTarefas } from '../../../domain/entities/Area'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { FecharSprintsVencidos } from '../sprints/FecharSprintsVencidos'
import type { ID } from '../../../shared/types/common'

export class RemoverArea {
  constructor(
    private readonly areaRepository: AreaRepository,
    /** Fecha antes o sprint vencido (#71): liberar a área não depende só do cron. */
    private readonly fecharVencidos?: Pick<FecharSprintsVencidos, 'execute'>,
  ) {}

  /**
   * Área com tarefas só sai com uma escolha explícita (`destino`): mover as tarefas para
   * outra área ou excluí-las junto. As checagens vêm antes de qualquer escrita.
   *
   * #73: com tarefas no sprint aberto (concluídas ou não, inclusive filhas de Super task) a área não sai, nem
   * movendo nem excluindo junto: nenhuma das duas escolhas pode mudar o total do sprint. A trava vem antes da
   * escolha do destino e vale para as duas. Depois do fechamento a área sai normalmente e a foto não muda.
   */
  async execute(userId: ID, id: ID, destino?: DestinoDasTarefas, agora: Date = new Date()): Promise<void> {
    await this.fecharVencidos?.execute(userId, agora)

    const area = await this.areaRepository.buscarPorId(userId, id)
    if (!area) throw new NotFoundError('Área')
    if (area.sistema) throw new ConflictError('A área Rotina não pode ser excluída.')

    if ((await this.areaRepository.contarTarefasNoSprintAberto(userId, id)) > 0) {
      throw new ConflictError(
        'Esta área tem tarefas no sprint aberto: ela só pode ser excluída depois que o sprint fechar (sexta, 23:59).',
      )
    }

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
