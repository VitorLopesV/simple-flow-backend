import type { ID } from '../../shared/types/common'

/** Ocorrência calculada a partir de um item de rotina, ainda sem identidade própria. */
export interface OcorrenciaPlanejada {
  /** Nulo se o item foi removido depois da geração. */
  itemId: ID | null
  /** Cópia do nome do item: renomear a rotina depois da geração não muda o sprint. */
  nome: string
  data: string
  hora: string | null
  /** Posição da vez no dia, para o item (parte da chave de idempotência da geração). */
  indice: number
  /** Posição no sprint: por dia, vez sem hora primeiro, depois horário e nome. */
  ordem: number
}

export interface OcorrenciaRotina extends OcorrenciaPlanejada {
  id: ID
  sprintId: ID
  /** Sábado/domingo do modo "a cada N dias": fora do sprint e sem pontos. */
  lembrete: boolean
  concluidaEm: string | null
}
