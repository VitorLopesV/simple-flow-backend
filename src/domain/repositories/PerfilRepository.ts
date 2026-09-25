import type { Perfil, PerfilPayload } from '../entities/Usuario'
import type { ID } from '../../shared/types/common'

export interface PerfilRepository {
  buscar(userId: ID): Promise<Perfil | null>
  atualizar(userId: ID, payload: PerfilPayload): Promise<Perfil>
}
