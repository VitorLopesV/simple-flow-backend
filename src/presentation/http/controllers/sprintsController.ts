import type { Request, Response } from 'express'

import { ObterSprint } from '../../../application/use-cases/sprints/ObterSprint'
import { SupabaseItemRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseItemRotinaRepository'
import { SupabaseOcorrenciaRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository'
import { SupabaseSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseSprintRepository'

function obterSprint(req: Request) {
  return new ObterSprint(
    new SupabaseSprintRepository(req.supabase!),
    new SupabaseOcorrenciaRotinaRepository(req.supabase!),
    new SupabaseItemRotinaRepository(req.supabase!),
  )
}

export const sprintsController = {
  async atual(req: Request, res: Response) {
    res.json(await obterSprint(req).execute(req.usuario!.id, 'ATUAL'))
  },

  async proximo(req: Request, res: Response) {
    res.json(await obterSprint(req).execute(req.usuario!.id, 'PROXIMO'))
  },
}
