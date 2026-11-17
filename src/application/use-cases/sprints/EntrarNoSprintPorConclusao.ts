import type { Tarefa } from '../../../domain/entities/Tarefa'
import { NotFoundError } from '../../../domain/errors/DomainError'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { motivoDeRecusa } from '../../../domain/services/sprintDaTarefa'
import type { ID } from '../../../shared/types/common'
import { dataAtual } from '../../../shared/utils/periodo'
import { garantirSprintDoDia } from './garantirSprintDoDia'

export interface ResultadoEntradaPorConclusao {
  tarefa: Tarefa
  entrou: boolean
  /** Por que não entrou (mensagem pronta); nulo quando entrou. */
  motivo: string | null
}

/**
 * Regra de "entrada por conclusão", chamada pela conclusão de tarefa (#70) ANTES de gravar a
 * conclusão: concluir num dia útil uma tarefa fora do sprint a puxa para o sprint atual,
 * naquele dia. Não conclui nada. Não entra (sem erro) se a tarefa já está em algum sprint,
 * está arquivada, é fim de semana ou falta tempo, dificuldade ou prioridade: a conclusão
 * segue valendo, só não pontua.
 */
export class EntrarNoSprintPorConclusao {
  constructor(
    private readonly tarefaRepository: TarefaRepository,
    private readonly sprintRepository: SprintRepository,
  ) {}

  async execute(userId: ID, tarefaId: ID, agora: Date = new Date()): Promise<ResultadoEntradaPorConclusao> {
    const tarefa = await this.tarefaRepository.buscarPorId(userId, tarefaId)
    if (!tarefa) throw new NotFoundError('Tarefa')

    if (tarefa.sprintId) return { tarefa, entrou: false, motivo: 'A tarefa já está no sprint.' }
    if (tarefa.arquivada) return { tarefa, entrou: false, motivo: 'Tarefas arquivadas não entram no sprint.' }

    const hoje = dataAtual(agora)
    const motivo = motivoDeRecusa({ ...tarefa, dia: hoje }, hoje, agora)
    if (motivo) return { tarefa, entrou: false, motivo }

    const sprintId = await garantirSprintDoDia(this.sprintRepository, userId, hoje)
    const atualizada = await this.tarefaRepository.definirSprint(userId, tarefaId, { sprintId, dia: hoje })
    return { tarefa: atualizada, entrou: true, motivo: null }
  }
}
