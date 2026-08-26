import type { SaidaResumo } from '../../../domain/entities/Saida'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID, Periodo } from '../../../shared/types/common'

export class ResumoSaidas {
  constructor(private readonly saidaRepository: SaidaRepository) {}

  execute(userId: ID, periodo: Periodo): Promise<SaidaResumo> {
    return this.saidaRepository.resumo(userId, periodo)
  }
}
