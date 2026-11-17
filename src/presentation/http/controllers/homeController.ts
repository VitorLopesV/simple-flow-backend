import type { Request, Response } from 'express'

import { ResumoDashboard } from '../../../application/use-cases/dashboard/ResumoDashboard'
import { ResumoDaHome } from '../../../application/use-cases/home/ResumoDaHome'
import { FecharSprintsVencidos } from '../../../application/use-cases/sprints/FecharSprintsVencidos'
import { ObterSprint } from '../../../application/use-cases/sprints/ObterSprint'
import { SupabaseDashboardRepository } from '../../../infrastructure/supabase/repositories/SupabaseDashboardRepository'
import { SupabaseItemRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseItemRotinaRepository'
import { SupabaseOcorrenciaRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository'
import { SupabaseRecompensaPadraoRepository } from '../../../infrastructure/supabase/repositories/SupabaseRecompensaPadraoRepository'
import { SupabaseSaidaRepository } from '../../../infrastructure/supabase/repositories/SupabaseSaidaRepository'
import { SupabaseSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseSprintRepository'
import { SupabaseTarefaRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefaRepository'
import { SupabaseTarefasDoSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository'

export const homeController = {
  async resumo(req: Request, res: Response) {
    const supabase = req.supabase!
    const sprintRepository = new SupabaseSprintRepository(supabase)
    const ocorrenciaRepository = new SupabaseOcorrenciaRotinaRepository(supabase)
    const tarefasDoSprintRepository = new SupabaseTarefasDoSprintRepository(supabase)
    const padraoRepository = new SupabaseRecompensaPadraoRepository(supabase)

    // Mesma composição de `sprintsController`: o fechamento de reserva roda antes de montar o sprint.
    const obterSprint = new ObterSprint(
      sprintRepository,
      ocorrenciaRepository,
      new SupabaseItemRotinaRepository(supabase),
      new FecharSprintsVencidos(sprintRepository, ocorrenciaRepository, tarefasDoSprintRepository, padraoRepository),
      padraoRepository,
    )

    const resumo = await new ResumoDaHome(
      obterSprint,
      tarefasDoSprintRepository,
      new SupabaseTarefaRepository(supabase),
      new SupabaseSaidaRepository(supabase),
      new ResumoDashboard(new SupabaseDashboardRepository(supabase)),
    ).execute(req.usuario!.id)

    res.json(resumo)
  },
}
