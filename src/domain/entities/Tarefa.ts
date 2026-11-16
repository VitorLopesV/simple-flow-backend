import type { ID } from '../../shared/types/common'

export type TempoEstimado = 15 | 30 | 60 | 120 | 240
export type Dificuldade = 'FACIL' | 'MEDIA' | 'DIFICIL'
export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA'

/**
 * Item do backlog do módulo Organização. Pertence a uma única área comum (nunca à Rotina).
 * Só o título é obrigatório; o resto é exigido apenas para entrar no sprint.
 */
export interface Tarefa {
  id: ID
  areaId: ID
  titulo: string
  /** YYYY-MM-DD */
  dia: string | null
  /** HH:MM */
  hora: string | null
  /** Em minutos. */
  tempoEstimado: TempoEstimado | null
  dificuldade: Dificuldade | null
  prioridade: Prioridade | null
  notas: string | null
  arquivada: boolean
  arquivadaEm: string | null
  criadoEm: string
}

/** Campos editáveis; a área muda só por `MoverTarefa`, que valida o destino. */
export type TarefaEdicao = Omit<Tarefa, 'id' | 'areaId' | 'arquivada' | 'arquivadaEm' | 'criadoEm'>

export type TarefaPayload = TarefaEdicao & Pick<Tarefa, 'areaId'>

export interface FiltroTarefas {
  areaId?: ID
  /** Arquivadas ficam ocultas por padrão; true as inclui. */
  incluirArquivadas: boolean
}
