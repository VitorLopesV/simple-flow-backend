import type { ID } from '../../shared/types/common'
import type { Categoria } from '../entities/Categoria'

export interface CategoriaRepository {
  /** Categorias do sistema (userId nulo) + as próprias do usuário. */
  listar(userId: ID): Promise<Categoria[]>
  /** Categoria do sistema ou do próprio usuário; null se não existir (ou for de outro usuário). */
  buscarPorId(userId: ID, id: ID): Promise<Categoria | null>
}
