import type { ID } from '../../shared/types/common'
import type { Area, AreaPayload } from '../entities/Area'

export interface AreaRepository {
  /** Áreas do usuário: a do sistema primeiro, depois por nome. */
  listar(userId: ID): Promise<Area[]>
  buscarPorId(userId: ID, id: ID): Promise<Area | null>
  /** Busca sem diferenciar maiúsculas; usada para garantir o nome único por usuário. */
  buscarPorNome(userId: ID, nome: string): Promise<Area | null>
  criar(userId: ID, payload: AreaPayload): Promise<Area>
  atualizar(userId: ID, id: ID, payload: AreaPayload): Promise<Area>
  remover(userId: ID, id: ID): Promise<void>
  contarTarefas(userId: ID, areaId: ID): Promise<number>
  moverTarefas(userId: ID, deAreaId: ID, paraAreaId: ID): Promise<void>
  removerTarefas(userId: ID, areaId: ID): Promise<void>
}
