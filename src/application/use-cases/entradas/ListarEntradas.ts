import type { Entrada } from '../../../domain/entities/Entrada'
import type { EntradaFiltro, EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID, Paginated } from '../../../shared/types/common'

export class ListarEntradas {
  constructor(private readonly entradaRepository: EntradaRepository) {}

  execute(userId: ID, filtro: EntradaFiltro): Promise<Paginated<Entrada>> {
    return this.entradaRepository.listar(userId, filtro)
  }
}
