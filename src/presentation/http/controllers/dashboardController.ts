import type { Request, Response } from 'express'

import { ResumoDashboard } from '../../../application/use-cases/dashboard/ResumoDashboard'
import { SupabaseDashboardRepository } from '../../../infrastructure/supabase/repositories/SupabaseDashboardRepository'
import { paraPeriodo } from '../../../shared/utils/periodo'

export const dashboardController = {
  async resumo(req: Request, res: Response) {
    const { competencia } = req.query as unknown as { competencia: string }
    const dashboardRepository = new SupabaseDashboardRepository(req.supabase!)

    const resumo = await new ResumoDashboard(dashboardRepository).execute(req.usuario!.id, paraPeriodo(competencia))
    res.json(resumo)
  },
}
