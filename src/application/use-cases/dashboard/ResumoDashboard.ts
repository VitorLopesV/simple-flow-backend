import type { DashboardResumo } from '../../../domain/entities/Dashboard'
import type { DashboardRepository } from '../../../domain/repositories/DashboardRepository'
import type { ID, Periodo } from '../../../shared/types/common'

export class ResumoDashboard {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  execute(userId: ID, periodo: Periodo): Promise<DashboardResumo> {
    return this.dashboardRepository.resumo(userId, periodo)
  }
}
