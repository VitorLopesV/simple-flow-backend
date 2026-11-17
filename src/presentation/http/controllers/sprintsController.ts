import type { Request, Response } from 'express'

import { AdicionarTarefaAoSprint } from '../../../application/use-cases/sprints/AdicionarTarefaAoSprint'
import { ConcluirOcorrenciaRotina } from '../../../application/use-cases/sprints/ConcluirOcorrenciaRotina'
import { DefinirRecompensaDoSprint } from '../../../application/use-cases/sprints/DefinirRecompensaDoSprint'
import { FecharSprintsVencidos } from '../../../application/use-cases/sprints/FecharSprintsVencidos'
import { ListarHistoricoDeSprints } from '../../../application/use-cases/sprints/ListarHistoricoDeSprints'
import { MoverTarefaNoSprint } from '../../../application/use-cases/sprints/MoverTarefaNoSprint'
import { ObterPlacarDoSprint } from '../../../application/use-cases/sprints/ObterPlacarDoSprint'
import { ObterSprint } from '../../../application/use-cases/sprints/ObterSprint'
import { DefinirRecompensaPadrao, ObterRecompensaPadrao } from '../../../application/use-cases/sprints/RecompensaPadrao'
import { RemoverTarefaDoSprint } from '../../../application/use-cases/sprints/RemoverTarefaDoSprint'
import { SupabaseItemRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseItemRotinaRepository'
import { SupabaseOcorrenciaRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository'
import { SupabaseRecompensaPadraoRepository } from '../../../infrastructure/supabase/repositories/SupabaseRecompensaPadraoRepository'
import { SupabaseSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseSprintRepository'
import { SupabaseTarefaRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefaRepository'
import { SupabaseTarefasDoSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository'

function fecharVencidos(req: Request) {
  return new FecharSprintsVencidos(
    new SupabaseSprintRepository(req.supabase!),
    new SupabaseOcorrenciaRotinaRepository(req.supabase!),
    new SupabaseTarefasDoSprintRepository(req.supabase!),
    new SupabaseRecompensaPadraoRepository(req.supabase!),
  )
}

function obterSprint(req: Request) {
  return new ObterSprint(
    new SupabaseSprintRepository(req.supabase!),
    new SupabaseOcorrenciaRotinaRepository(req.supabase!),
    new SupabaseItemRotinaRepository(req.supabase!),
    fecharVencidos(req),
    new SupabaseRecompensaPadraoRepository(req.supabase!),
  )
}

function obterPlacar(req: Request) {
  return new ObterPlacarDoSprint(obterSprint(req), new SupabaseTarefasDoSprintRepository(req.supabase!))
}

function tarefaRepositorio(req: Request) {
  return new SupabaseTarefaRepository(req.supabase!)
}

function sprintRepositorio(req: Request) {
  return new SupabaseSprintRepository(req.supabase!)
}

function definirRecompensa(req: Request, alvo: 'ATUAL' | 'PROXIMO') {
  return new DefinirRecompensaDoSprint(
    obterSprint(req),
    sprintRepositorio(req),
    new SupabaseRecompensaPadraoRepository(req.supabase!),
  ).execute(req.usuario!.id, alvo, req.body.recompensa)
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

  async recompensaAtual(req: Request, res: Response) {
    res.json(await definirRecompensa(req, 'ATUAL'))
  },

  async recompensaProximo(req: Request, res: Response) {
    res.json(await definirRecompensa(req, 'PROXIMO'))
  },

  async obterRecompensaPadrao(req: Request, res: Response) {
    res.json(await new ObterRecompensaPadrao(new SupabaseRecompensaPadraoRepository(req.supabase!)).execute(req.usuario!.id))
  },

  async definirRecompensaPadrao(req: Request, res: Response) {
    res.json(
      await new DefinirRecompensaPadrao(new SupabaseRecompensaPadraoRepository(req.supabase!)).execute(
        req.usuario!.id,
        req.body.recompensaPadrao,
      ),
    )
  },

  async historico(req: Request, res: Response) {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number }
    res.json(await new ListarHistoricoDeSprints(sprintRepositorio(req)).execute(req.usuario!.id, page, pageSize))
  },

  async concluirOcorrencia(req: Request, res: Response) {
    res.json(
      await new ConcluirOcorrenciaRotina(new SupabaseOcorrenciaRotinaRepository(req.supabase!)).execute(
        req.usuario!.id,
        req.params.id,
      ),
    )
  },

  async adicionarTarefa(req: Request, res: Response) {
    const { tarefaId, dia } = req.body
    const tarefa = await new AdicionarTarefaAoSprint(tarefaRepositorio(req), sprintRepositorio(req)).execute(
      req.usuario!.id,
      tarefaId,
      dia,
    )
    res.status(201).json(tarefa)
  },

  async moverTarefa(req: Request, res: Response) {
    const tarefa = await new MoverTarefaNoSprint(tarefaRepositorio(req), sprintRepositorio(req)).execute(
      req.usuario!.id,
      req.params.id,
      req.body.dia,
    )
    res.json(tarefa)
  },

  async removerTarefa(req: Request, res: Response) {
    res.json(await new RemoverTarefaDoSprint(tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id))
  },
}
