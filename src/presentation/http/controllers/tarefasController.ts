import type { Request, Response } from 'express'

import { ArquivarTarefa } from '../../../application/use-cases/tarefas/ArquivarTarefa'
import { AtualizarTarefa } from '../../../application/use-cases/tarefas/AtualizarTarefa'
import { CriarTarefa } from '../../../application/use-cases/tarefas/CriarTarefa'
import { DesarquivarTarefa } from '../../../application/use-cases/tarefas/DesarquivarTarefa'
import { ListarTarefas } from '../../../application/use-cases/tarefas/ListarTarefas'
import { MoverTarefa } from '../../../application/use-cases/tarefas/MoverTarefa'
import { RemoverTarefa } from '../../../application/use-cases/tarefas/RemoverTarefa'
import { SupabaseAreaRepository } from '../../../infrastructure/supabase/repositories/SupabaseAreaRepository'
import { SupabaseTarefaRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefaRepository'

function tarefaRepositorio(req: Request) {
  return new SupabaseTarefaRepository(req.supabase!)
}

function areaRepositorio(req: Request) {
  return new SupabaseAreaRepository(req.supabase!)
}

export const tarefasController = {
  async listar(req: Request, res: Response) {
    // Query já validada por `listarTarefasQuerySchema`.
    const { areaId, arquivadas } = req.query as unknown as { areaId?: string; arquivadas: boolean }
    const tarefas = await new ListarTarefas(tarefaRepositorio(req)).execute(req.usuario!.id, {
      areaId,
      incluirArquivadas: arquivadas,
    })
    res.json(tarefas)
  },

  async criar(req: Request, res: Response) {
    const tarefa = await new CriarTarefa(tarefaRepositorio(req), areaRepositorio(req)).execute(
      req.usuario!.id,
      req.body,
    )
    res.status(201).json(tarefa)
  },

  async atualizar(req: Request, res: Response) {
    const tarefa = await new AtualizarTarefa(tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id, req.body)
    res.json(tarefa)
  },

  async mover(req: Request, res: Response) {
    const tarefa = await new MoverTarefa(tarefaRepositorio(req), areaRepositorio(req)).execute(
      req.usuario!.id,
      req.params.id,
      req.body.areaId,
    )
    res.json(tarefa)
  },

  async arquivar(req: Request, res: Response) {
    res.json(await new ArquivarTarefa(tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id))
  },

  async desarquivar(req: Request, res: Response) {
    res.json(await new DesarquivarTarefa(tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id))
  },

  async remover(req: Request, res: Response) {
    await new RemoverTarefa(tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id)
    res.status(204).send()
  },
}
