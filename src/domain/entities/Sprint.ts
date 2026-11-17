import type { ID } from '../../shared/types/common'
import type { FotoDoSprint } from './PlacarDoSprint'

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
  /** Recompensa real definida para este sprint (#72); nula = usa a padrão do usuário. Só muda enquanto ABERTO. */
  recompensa: string | null
  /** Instante do fechamento (sexta 23:59 SP); nulo enquanto aberto. */
  fechadoEm: string | null
  /** Foto do fechamento (mesmo formato do placar); imutável depois de gravada, nula enquanto aberto. */
  foto: FotoDoSprint | null
  /** O fechamento terminou (tarefas devolvidas, próximo sprint criado); se nulo num sprint vencido, a reserva refaz o que faltar. */
  fechamentoAplicadoEm: string | null
}
