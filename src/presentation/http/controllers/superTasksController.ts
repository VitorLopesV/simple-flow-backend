import type { Request, Response } from 'express'

import { AdicionarTarefaASuperTask } from '../../../application/use-cases/superTasks/AdicionarTarefaASuperTask'
import { ArquivarSuperTask } from '../../../application/use-cases/superTasks/ArquivarSuperTask'
import { AtualizarSuperTask } from '../../../application/use-cases/superTasks/AtualizarSuperTask'
import { ConverterTarefaEmSuperTask } from '../../../application/use-cases/superTasks/ConverterTarefaEmSuperTask'
import { CriarSuperTask } from '../../../application/use-cases/superTasks/CriarSuperTask'
import { DesmarcarSuperTaskConcluida } from '../../../application/use-cases/superTasks/DesmarcarSuperTaskConcluida'
import { ListarSuperTasks } from '../../../application/use-cases/superTasks/ListarSuperTasks'
import { MarcarSuperTaskConcluida } from '../../../application/use-cases/superTasks/MarcarSuperTaskConcluida'
import { MoverSuperTask } from '../../../application/use-cases/superTasks/MoverSuperTask'
import { ObterSuperTask } from '../../../application/use-cases/superTasks/ObterSuperTask'
import { RemoverSuperTask } from '../../../application/use-cases/superTasks/RemoverSuperTask'
import { RetirarTarefaDaSuperTask } from '../../../application/use-cases/superTasks/RetirarTarefaDaSuperTask'
import type { DestinoDasFilhas } from '../../../domain/entities/SuperTask'
import { SupabaseAreaRepository } from '../../../infrastructure/supabase/repositories/SupabaseAreaRepository'
import { SupabaseSuperTaskRepository } from '../../../infrastructure/supabase/repositories/SupabaseSuperTaskRepository'
import { SupabaseTarefaRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefaRepository'

function superTaskRepositorio(req: Request) {
  return new SupabaseSuperTaskRepository(req.supabase!)
}

function tarefaRepositorio(req: Request) {
  return new SupabaseTarefaRepository(req.supabase!)
}

function areaRepositorio(req: Request) {
  return new SupabaseAreaRepository(req.supabase!)
}

export const superTasksController = {
  async listar(req: Request, res: Response) {
    // Query já validada por `listarSuperTasksQuerySchema`.
    const { areaId, arquivadas } = req.query as unknown as { areaId?: string; arquivadas: boolean }
    const superTasks = await new ListarSuperTasks(superTaskRepositorio(req), tarefaRepositorio(req)).execute(
      req.usuario!.id,
      { areaId, incluirArquivadas: arquivadas },
    )
    res.json(superTasks)
  },

  async obter(req: Request, res: Response) {
    res.json(await new ObterSuperTask(superTaskRepositorio(req), tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id))
  },

  async criar(req: Request, res: Response) {
    const superTask = await new CriarSuperTask(superTaskRepositorio(req), areaRepositorio(req)).execute(
      req.usuario!.id,
      req.body,
    )
    res.status(201).json(superTask)
  },

  async converter(req: Request, res: Response) {
    const superTask = await new ConverterTarefaEmSuperTask(tarefaRepositorio(req), superTaskRepositorio(req)).execute(
      req.usuario!.id,
      req.body.tarefaId,
      req.body.dataTermino,
    )
    res.status(201).json(superTask)
  },

  async atualizar(req: Request, res: Response) {
    const superTask = await new AtualizarSuperTask(superTaskRepositorio(req), tarefaRepositorio(req)).execute(
      req.usuario!.id,
      req.params.id,
      req.body,
    )
    res.json(superTask)
  },

  async mover(req: Request, res: Response) {
    const superTask = await new MoverSuperTask(superTaskRepositorio(req), tarefaRepositorio(req), areaRepositorio(req)).execute(
      req.usuario!.id,
      req.params.id,
      req.body.areaId,
    )
    res.json(superTask)
  },

  async concluir(req: Request, res: Response) {
    res.json(
      await new MarcarSuperTaskConcluida(superTaskRepositorio(req), tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id),
    )
  },

  async desmarcarConclusao(req: Request, res: Response) {
    res.json(
      await new DesmarcarSuperTaskConcluida(superTaskRepositorio(req), tarefaRepositorio(req)).execute(
        req.usuario!.id,
        req.params.id,
      ),
    )
  },

  async arquivar(req: Request, res: Response) {
    res.json(
      await new ArquivarSuperTask(superTaskRepositorio(req), tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id, true),
    )
  },

  async desarquivar(req: Request, res: Response) {
    res.json(
      await new ArquivarSuperTask(superTaskRepositorio(req), tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id, false),
    )
  },

  async remover(req: Request, res: Response) {
    // Query já validada por `removerSuperTaskQuerySchema` (já traduzida para SOLTAR/EXCLUIR).
    const { filhas } = req.query as unknown as { filhas: DestinoDasFilhas }
    await new RemoverSuperTask(superTaskRepositorio(req), tarefaRepositorio(req)).execute(req.usuario!.id, req.params.id, filhas)
    res.status(204).send()
  },

  async adicionarFilha(req: Request, res: Response) {
    const superTask = await new AdicionarTarefaASuperTask(superTaskRepositorio(req), tarefaRepositorio(req)).execute(
      req.usuario!.id,
      req.params.id,
      req.body.tarefaId,
    )
    res.status(201).json(superTask)
  },

  async retirarFilha(req: Request, res: Response) {
    const superTask = await new RetirarTarefaDaSuperTask(superTaskRepositorio(req), tarefaRepositorio(req)).execute(
      req.usuario!.id,
      req.params.id,
      req.params.tarefaId,
    )
    res.json(superTask)
  },
}
