import type { SuperTask, SuperTaskDetalhada } from '../../../domain/entities/SuperTask'
import type { Tarefa } from '../../../domain/entities/Tarefa'
import { calcularProgresso } from '../../../domain/services/progressoDaSuperTask'
import { dataAtual } from '../../../shared/utils/periodo'

/** Junta a Super task às filhas e aos valores derivados delas (progresso, estado, vencida). */
export function detalharSuperTask(superTask: SuperTask, filhas: Tarefa[], agora: Date): SuperTaskDetalhada {
  return { ...superTask, filhas, ...calcularProgresso(superTask, filhas, dataAtual(agora)) }
}
