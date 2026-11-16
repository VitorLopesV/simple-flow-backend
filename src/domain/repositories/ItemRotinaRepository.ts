import type { ID } from '../../shared/types/common'
import type { ItemRotina, ItemRotinaPayload } from '../entities/ItemRotina'

export interface ItemRotinaRepository {
  /** Por nome (sem diferenciar maiúsculas). */
  listar(userId: ID): Promise<ItemRotina[]>
  buscarPorId(userId: ID, id: ID): Promise<ItemRotina | null>
  criar(userId: ID, areaId: ID, payload: ItemRotinaPayload): Promise<ItemRotina>
  atualizar(userId: ID, id: ID, payload: ItemRotinaPayload): Promise<ItemRotina>
  remover(userId: ID, id: ID): Promise<void>
}
