import type { EntradaResumo } from '../../../domain/entities/Entrada'
import type { EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID, Periodo } from '../../../shared/types/common'

export class ResumoEntradas {
  constructor(private readonly entradaRepository: EntradaRepository) {}

  execute(userId: ID, periodo: Periodo): Promise<EntradaResumo> {
    return this.entradaRepository.resumo(userId, periodo)
  }
}
