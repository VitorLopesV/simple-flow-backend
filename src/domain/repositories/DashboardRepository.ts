import type { DashboardResumo } from '../entities/Dashboard'
import type { ID, Periodo } from '../../shared/types/common'

export interface DashboardRepository {
  resumo(userId: ID, periodo: Periodo): Promise<DashboardResumo>
}
