import type { Request, Response } from 'express'

import { ArquivarTarefa } from '../../../application/use-cases/tarefas/ArquivarTarefa'
import { AtualizarTarefa } from '../../../application/use-cases/tarefas/AtualizarTarefa'
import { FecharSprintsVencidos } from '../../../application/use-cases/sprints/FecharSprintsVencidos'
import { ConcluirTarefa } from '../../../application/use-cases/tarefas/ConcluirTarefa'
import { CriarTarefa } from '../../../application/use-cases/tarefas/CriarTarefa'
import { DesarquivarTarefa } from '../../../application/use-cases/tarefas/DesarquivarTarefa'
import { DesmarcarConclusaoTarefa } from '../../../application/use-cases/tarefas/DesmarcarConclusaoTarefa'
import { ListarTarefas } from '../../../application/use-cases/tarefas/ListarTarefas'
import { MoverTarefa } from '../../../application/use-cases/tarefas/MoverTarefa'
import { RemoverTarefa } from '../../../application/use-cases/tarefas/RemoverTarefa'
import { SupabaseAreaRepository } from '../../../infrastructure/supabase/repositories/SupabaseAreaRepository'
import { SupabaseOcorrenciaRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository'
import { SupabaseTarefasDoSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository'
import { SupabaseSuperTaskRepository } from '../../../infrastructure/supabase/repositories/SupabaseSuperTaskRepository'
import { SupabaseSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseSprintRepository'
import { SupabaseTarefaRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefaRepository'

function tarefaRepositorio(req: Request) {
  return new SupabaseTarefaRepository(req.supabase!)
}

function sprintRepositorio(req: Request) {
  return new SupabaseSprintRepository(req.supabase!)
}

function superTaskRepositorio(req: Request) {
  return new SupabaseSuperTaskRepository(req.supabase!)
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
    const tarefa = await new CriarTarefa(tarefaRepositorio(req), areaRepositorio(req), sprintRepositorio(req)).execute(
      req.usuario!.id,
      req.body,
    )
    res.status(201).json(tarefa)
  },

  async atualizar(req: Request, res: Response) {
    const tarefa = await new AtualizarTarefa(tarefaRepositorio(req), sprintRepositorio(req)).execute(
      req.usuario!.id,
      req.params.id,
      req.body,
    )
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

  async concluir(req: Request, res: Response) {
    // Reserva do job de fechamento (#71): fecha antes o sprint vencido, para a conclusão não entrar nele.
    const fecharVencidos = new FecharSprintsVencidos(
      sprintRepositorio(req),
      new SupabaseOcorrenciaRotinaRepository(req.supabase!),
      new SupabaseTarefasDoSprintRepository(req.supabase!),
    )
    const concluir = new ConcluirTarefa(
      tarefaRepositorio(req),
      sprintRepositorio(req),
      superTaskRepositorio(req),
      fecharVencidos,
    )
    res.json(await concluir.execute(req.usuario!.id, req.params.id))
  },

  async desmarcarConclusao(req: Request, _res: Response) {
    await new DesmarcarConclusaoTarefa(tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id)
  },

  async arquivar(req: Request, res: Response) {
    res.json(await new ArquivarTarefa(tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id))
  },

  async desarquivar(req: Request, res: Response) {
    res.json(await new DesarquivarTarefa(tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id))
  },

  async remover(req: Request, res: Response) {
    await new RemoverTarefa(tarefaRepositorio(req), superTaskRepositorio(req)).execute(req.usuario!.id, req.params.id)
    res.status(204).send()
  },
}
