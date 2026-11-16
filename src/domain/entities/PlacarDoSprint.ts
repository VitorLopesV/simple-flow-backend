import type { ID } from '../../shared/types/common'
import type { Dificuldade, Prioridade, TempoEstimado } from './Tarefa'

/** Tarefa que está no sprint, no formato que o placar precisa. */
export interface TarefaDoSprint {
  id: ID
  /** YYYY-MM-DD */
  dia: string
  tempoEstimado: TempoEstimado
  dificuldade: Dificuldade
  prioridade: Prioridade
  concluida: boolean
  /**
   * Ponto de extensão da #70: concluída fora do prazo. O placar já respeita (vale 20%);
   * quem calcula o atraso (com e sem hora) é a #70.
   */
  atrasada: boolean
  /** Super task nunca pontua (#65). */
  superTask: boolean
}

export interface PlacarDoSprint {
  /** 40 × dias de rotina + pontos cheios das tarefas no sprint. Volátil. */
  total: number
  /** Pontos dos dias de rotina cumpridos + pontos das tarefas concluídas. */
  feitos: number
  /** 0–100, uma casa decimal; 0 quando o total é 0. */
  percentual: number
  /** ≥ 90% do total; nunca com total 0. */
  bonus: boolean
  rotina: { diasComRotina: number; diasCumpridos: number; pontosPorDia: number; total: number; feitos: number }
  tarefas: { quantidade: number; concluidas: number; total: number; feitos: number }
}
