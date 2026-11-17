import type { Request, Response } from 'express'

import { ObterAlertasDoSino } from '../../../application/use-cases/alertas/ObterAlertasDoSino'
import { FecharSprintsVencidos } from '../../../application/use-cases/sprints/FecharSprintsVencidos'
import { ObterSprint } from '../../../application/use-cases/sprints/ObterSprint'
import { SupabaseItemRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseItemRotinaRepository'
import { SupabaseOcorrenciaRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository'
import { SupabaseRecompensaPadraoRepository } from '../../../infrastructure/supabase/repositories/SupabaseRecompensaPadraoRepository'
import { SupabaseSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseSprintRepository'
import { SupabaseTarefasDoSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository'

export const alertasController = {
  async listar(req: Request, res: Response) {
    const supabase = req.supabase!
    const sprintRepository = new SupabaseSprintRepository(supabase)
    const ocorrenciaRepository = new SupabaseOcorrenciaRotinaRepository(supabase)
    const tarefasDoSprintRepository = new SupabaseTarefasDoSprintRepository(supabase)
    const padraoRepository = new SupabaseRecompensaPadraoRepository(supabase)

    // Mesma composição de `homeController`: o fechamento de reserva roda antes de calcular os alertas.
    const obterSprint = new ObterSprint(
      sprintRepository,
      ocorrenciaRepository,
      new SupabaseItemRotinaRepository(supabase),
      new FecharSprintsVencidos(sprintRepository, ocorrenciaRepository, tarefasDoSprintRepository, padraoRepository),
      padraoRepository,
    )

    res.json(await new ObterAlertasDoSino(obterSprint, tarefasDoSprintRepository, sprintRepository).execute(req.usuario!.id))
  },
}
