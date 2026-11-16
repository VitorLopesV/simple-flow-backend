import type { ID } from '../../shared/types/common'
import type { Tarefa } from './Tarefa'

export type EstadoSuperTask = 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'CONCLUIDA'

/**
 * Agrupa tarefas filhas de um trabalho grande (#65). Não pontua e nunca entra no sprint: por isso
 * é uma entidade própria e não uma `Tarefa`. Só tem título, área, notas e Data de término; progresso
 * e estado saem das filhas (ver `calcularProgresso`), só a conclusão é gravada (`concluidaEm`).
 */
export interface SuperTask {
  id: ID
  areaId: ID
  titulo: string
  notas: string | null
  /** YYYY-MM-DD, opcional. Vencida é só um destaque de leitura (`vencida`). */
  dataTermino: string | null
  /** Preenchido ao chegar a 100% (automático) ou ao marcar de novo; null = aberta ou reaberta. */
  concluidaEm: string | null
  /** Trava: concluída não aceita filhas novas nem edição até ser reaberta. */
  concluida: boolean
  arquivada: boolean
  arquivadaEm: string | null
  criadoEm: string
}

export type SuperTaskEdicao = Pick<SuperTask, 'titulo' | 'notas' | 'dataTermino'>
export type SuperTaskPayload = SuperTaskEdicao & Pick<SuperTask, 'areaId'>

export interface FiltroSuperTasks {
  areaId?: ID
  /** Arquivadas ficam ocultas por padrão; true as inclui. */
  incluirArquivadas: boolean
}

/** O que fazer com as filhas ao excluir a Super task. */
export type DestinoDasFilhas = 'SOLTAR' | 'EXCLUIR'

/** Leitura da Super task: as filhas e os valores derivados delas. */
export interface SuperTaskDetalhada extends SuperTask {
  filhas: Tarefa[]
  totalFilhas: number
  filhasConcluidas: number
  /** Inteiro de 0 a 100, arredondado para baixo: só chega a 100 com todas as filhas concluídas. */
  progresso: number
  estado: EstadoSuperTask
  /** Data de término passada sem estar concluída. Só um destaque: não gera atraso, pontos nem alerta. */
  vencida: boolean
  /** Todas as filhas concluídas, mas a Super task ainda não está (reaberta): pode ser marcada de novo. */
  podeConcluir: boolean
}
