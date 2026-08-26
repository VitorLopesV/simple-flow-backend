import type { CartaoComFatura, FaturaFiltro } from '../../../domain/entities/Fatura'
import type { FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'

export class ListarFaturasDoCartao {
  constructor(private readonly faturaRepository: FaturaRepository) {}

  execute(userId: ID, filtro: FaturaFiltro): Promise<CartaoComFatura[]> {
    return this.faturaRepository.listarComFaturas(userId, filtro)
  }
}
