import type { ID } from '../../shared/types/common'
import type { OcorrenciaPlanejada, OcorrenciaRotina } from '../entities/OcorrenciaRotina'

export interface OcorrenciaRotinaRepository {
  /** Em ordem de exibição (`ordem`). */
  listarDoSprint(userId: ID, sprintId: ID): Promise<OcorrenciaRotina[]>
  buscarPorId(userId: ID, id: ID): Promise<OcorrenciaRotina | null>
  /** Grava `concluida_em`; só preenche se ainda não houver conclusão. */
  concluir(userId: ID, id: ID, concluidaEm: string): Promise<OcorrenciaRotina>
  /** Idempotente: ocorrência que já existe (mesmo sprint, item, data e índice) é ignorada, não duplicada. */
  inserirVarias(
    userId: ID,
    sprintId: ID,
    ocorrencias: OcorrenciaPlanejada[],
    lembretes: OcorrenciaPlanejada[],
  ): Promise<void>
}
