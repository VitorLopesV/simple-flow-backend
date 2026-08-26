import type { Saida } from '../../../domain/entities/Saida'
import type { SaidaFiltro, SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID, Paginated } from '../../../shared/types/common'

export class ListarSaidas {
  constructor(private readonly saidaRepository: SaidaRepository) {}

  execute(userId: ID, filtro: SaidaFiltro): Promise<Paginated<Saida>> {
    return this.saidaRepository.listar(userId, filtro)
  }
}
