import type { ID } from '../../shared/types/common'
import type { Categoria } from '../entities/Categoria'

export interface CategoriaRepository {
  /** Categorias do sistema (userId nulo) + as próprias do usuário. */
  listar(userId: ID): Promise<Categoria[]>
}
