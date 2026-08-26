import type { Categoria } from '../../../domain/entities/Categoria'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { ID } from '../../../shared/types/common'

export class ListarCategorias {
  constructor(private readonly categoriaRepository: CategoriaRepository) {}

  execute(userId: ID): Promise<Categoria[]> {
    return this.categoriaRepository.listar(userId)
  }
}
