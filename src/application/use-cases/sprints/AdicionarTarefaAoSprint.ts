import type { Tarefa } from '../../../domain/entities/Tarefa'
import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { MENSAGEM_TAREFA_CONCLUIDA, MENSAGEM_TAREFA_TRAVADA, motivoDeRecusa, tarefaTravada } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'
import { garantirSprintDoDia } from './garantirSprintDoDia'

export class AdicionarTarefaAoSprint {
  constructor(
    private readonly tarefaRepository: TarefaRepository,
    private readonly sprintRepository: SprintRepository,
  ) {}

  /**
   * Coloca no sprint (atual ou próximo, conforme o dia) uma tarefa avulsa. `dia` omitido usa o
   * dia que a tarefa já tem. Recusa com a causa clara: sem dia, fim de semana, dia que já passou,
   * fora do sprint atual/próximo ou faltando tempo, dificuldade ou prioridade.
   */
  async execute(userId: ID, tarefaId: ID, dia?: string, agora: Date = new Date()): Promise<Tarefa> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, tarefaId)
    if (!tarefa) throw new NotFoundError('Tarefa')
    if (tarefa.concluida) throw new ConflictError(MENSAGEM_TAREFA_CONCLUIDA)

    const hoje = dataAtual(agora)
    if (tarefaTravada(tarefa, hoje)) throw new ConflictError(MENSAGEM_TAREFA_TRAVADA)
    if (tarefa.sprintId) throw new ConflictError('A tarefa já está no sprint. Para trocar o dia, use mover.')
    if (tarefa.arquivada) throw new ValidationError('Tarefas arquivadas não entram no sprint.')

    const diaFinal = dia ?? tarefa.dia
    const motivo = motivoDeRecusa({ ...tarefa, dia: diaFinal }, hoje, agora)
    if (motivo) throw new ValidationError(motivo)

    const sprintId = await garantirSprintDoDia(this.sprintRepository, userId, diaFinal!)
    return this.tarefaRepository.definirSprint(userId, tarefaId, { sprintId, dia: diaFinal! })
  }
}
