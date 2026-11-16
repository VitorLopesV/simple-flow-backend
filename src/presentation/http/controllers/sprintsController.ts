import type { Request, Response } from 'express'

import { ObterPlacarDoSprint } from '../../../application/use-cases/sprints/ObterPlacarDoSprint'
import { ObterSprint } from '../../../application/use-cases/sprints/ObterSprint'
import { SupabaseItemRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseItemRotinaRepository'
import { SupabaseOcorrenciaRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository'
import { SupabaseSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseSprintRepository'
import { SupabaseTarefasDoSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository'

function obterSprint(req: Request) {
  return new ObterSprint(
    new SupabaseSprintRepository(req.supabase!),
    new SupabaseOcorrenciaRotinaRepository(req.supabase!),
    new SupabaseItemRotinaRepository(req.supabase!),
  )
}

function obterPlacar(req: Request) {
  return new ObterPlacarDoSprint(obterSprint(req), new SupabaseTarefasDoSprintRepository(req.supabase!))
}

export const sprintsController = {
  async placarAtual(req: Request, res: Response) {
    res.json(await obterPlacar(req).execute(req.usuario!.id, 'ATUAL'))
  },

  async placarProximo(req: Request, res: Response) {
    res.json(await obterPlacar(req).execute(req.usuario!.id, 'PROXIMO'))
  },

  async atual(req: Request, res: Response) {
    res.json(await obterSprint(req).execute(req.usuario!.id, 'ATUAL'))
  },

  async proximo(req: Request, res: Response) {
    res.json(await obterSprint(req).execute(req.usuario!.id, 'PROXIMO'))
  },
}
