import type { Dificuldade, Prioridade, TempoEstimado } from '../entities/Tarefa'

/** Única fonte dos números da gamificação: mexer na pontuação é mexer só aqui. */
export const CONFIGURACAO_PONTUACAO = {
  /** Base por tempo estimado, em minutos (Fibonacci). */
  baseDoTempo: { 15: 2, 30: 3, 60: 5, 120: 8, 240: 13 } as Record<TempoEstimado, number>,
  multiplicadorDeDificuldade: { FACIL: 1, MEDIA: 1.5, DIFICIL: 2 } as Record<Dificuldade, number>,
  multiplicadorDePrioridade: { BAIXA: 1, MEDIA: 1.2, ALTA: 1.5 } as Record<Prioridade, number>,
  /** Fração dos pontos que uma tarefa concluída com atraso vale. */
  fatorDeAtraso: 0.2,
  /** Pontos de cada dia útil de rotina cumprido por inteiro. */
  pontosDoDiaDeRotina: 40,
  /** Bônus a partir de 90% do total, em décimos para comparar só com inteiros. */
  bonusAPartirDeDecimos: 9,
}

export interface FatoresDePontuacao {
  tempoEstimado: TempoEstimado
  dificuldade: Dificuldade
  prioridade: Prioridade
}

/** Pontos de uma tarefa: base(tempo) × dificuldade × prioridade, arredondado; atrasada vale 20%. */
export function pontosDaTarefa(fatores: FatoresDePontuacao, atrasada = false): number {
  const c = CONFIGURACAO_PONTUACAO
  const cheios =
    c.baseDoTempo[fatores.tempoEstimado] *
    c.multiplicadorDeDificuldade[fatores.dificuldade] *
    c.multiplicadorDePrioridade[fatores.prioridade]
  return Math.round(atrasada ? cheios * c.fatorDeAtraso : cheios)
}
