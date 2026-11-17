import type { ID } from '../../shared/types/common'
import type { Dificuldade, Prioridade, TempoEstimado } from './Tarefa'

/** Tarefa que está no sprint, no formato que o placar precisa. */
export interface TarefaDoSprint {
  id: ID
  titulo: string
  /** YYYY-MM-DD */
  dia: string
  /** HH:MM; nulo = sem hora marcada. */
  hora: string | null
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

export type SituacaoTarefaNaFoto = 'CONCLUIDA' | 'ATRASADA' | 'NAO_CONCLUIDA'

/** Tarefa como ficou no fechamento: o histórico lê isto, não as tarefas ao vivo (que saem do sprint ou são excluídas). */
export interface TarefaNaFoto {
  id: ID
  titulo: string
  dia: string
  hora: string | null
  tempoEstimado: TempoEstimado
  dificuldade: Dificuldade
  prioridade: Prioridade
  /** Pontos cheios (entram no total). */
  pontos: number
  /** Pontos ganhos: 0 se não concluída; 20% se atrasada. */
  pontosGanhos: number
  situacao: SituacaoTarefaNaFoto
}

export interface ItemDeRotinaNaFoto {
  nome: string
  hora: string | null
  concluida: boolean
}

/** Resultado da rotina em um dia útil: cumprido só se todas as ocorrências do dia foram concluídas. */
export interface DiaDeRotinaNaFoto {
  data: string
  cumprido: boolean
  itens: ItemDeRotinaNaFoto[]
}

/** Placar congelado no fechamento (#71) com o detalhe e a recompensa vigente naquele momento (#72). */
export interface FotoDoSprint extends PlacarDoSprint {
  /** Recompensa efetiva no fechamento (a do sprint ou, na falta, a padrão vigente); nula se não havia nenhuma. */
  recompensa: string | null
  detalhe: { tarefas: TarefaNaFoto[]; rotina: DiaDeRotinaNaFoto[] }
}
