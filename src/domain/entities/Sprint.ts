import type { ID } from '../../shared/types/common'

export type SituacaoSprint = 'ABERTO' | 'FECHADO'

/** Semana de trabalho: `inicio` é a segunda e `fim` a sexta (`YYYY-MM-DD`, America/Sao_Paulo). */
export interface Sprint {
  id: ID
  inicio: string
  fim: string
  situacao: SituacaoSprint
  /** Preenchido quando as ocorrências de rotina da semana foram gravadas; nulo = sprint ainda não começou. */
  rotinaGeradaEm: string | null
  criadoEm: string
}
