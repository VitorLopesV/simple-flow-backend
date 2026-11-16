import type { ID } from '../../shared/types/common'

/**
 * Lista que agrupa tarefas no módulo Organização. `sistema` marca a área Rotina,
 * criada automaticamente, que não pode ser renomeada nem excluída.
 */
export interface Area {
  id: ID
  nome: string
  cor: string
  sistema: boolean
  criadoEm: string
}

export type AreaPayload = Pick<Area, 'nome' | 'cor'>

/** Escolha obrigatória ao excluir uma área que ainda tem tarefas. */
export type DestinoDasTarefas = { acao: 'MOVER'; areaDestinoId: ID } | { acao: 'EXCLUIR' }
