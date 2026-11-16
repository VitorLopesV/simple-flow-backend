import type { ID } from '../../shared/types/common'

/** Dia útil: 1 = segunda ... 5 = sexta (ISO). Fim de semana não é marcável. */
export type DiaUtil = 1 | 2 | 3 | 4 | 5

/**
 * Regra de repetição: dias da semana marcados (seg–sex) ou a cada N dias corridos
 * a partir de `dataInicial` (a ocorrência que cai no fim de semana vira só lembrete).
 */
export type Repeticao =
  | { modo: 'DIAS_DA_SEMANA'; dias: DiaUtil[] }
  | { modo: 'A_CADA_N_DIAS'; intervalo: number; dataInicial: string }

/** Uma vez no dia; `hora` (HH:MM) é opcional. */
export interface VezNoDia {
  hora: string | null
}

/**
 * "Missão" diária da área Rotina. Não tem pontuação própria: a rotina pontua por dia.
 */
export interface ItemRotina {
  id: ID
  areaId: ID
  nome: string
  repeticao: Repeticao
  /** Pelo menos uma; cada vez vira uma ocorrência separada. */
  vezes: VezNoDia[]
  criadoEm: string
}

export type ItemRotinaPayload = Pick<ItemRotina, 'nome' | 'repeticao' | 'vezes'>
