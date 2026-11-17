import type { Request, Response } from 'express'

import { AtualizarArea } from '../../../application/use-cases/areas/AtualizarArea'
import { CriarArea } from '../../../application/use-cases/areas/CriarArea'
import { ListarAreas } from '../../../application/use-cases/areas/ListarAreas'
import { RemoverArea } from '../../../application/use-cases/areas/RemoverArea'
import type { DestinoDasTarefas } from '../../../domain/entities/Area'
import { reservaDeFechamento } from './reservaDeFechamento'
import { SupabaseAreaRepository } from '../../../infrastructure/supabase/repositories/SupabaseAreaRepository'

function areaRepositorio(req: Request) {
  return new SupabaseAreaRepository(req.supabase!)
}

/** Query já validada por `removerAreaQuerySchema`. */
function destinoDasTarefas(req: Request): DestinoDasTarefas | undefined {
  const { tarefas, destinoId } = req.query as unknown as { tarefas?: 'mover' | 'excluir'; destinoId?: string }
  if (tarefas === 'mover') return { acao: 'MOVER', areaDestinoId: destinoId! }
  if (tarefas === 'excluir') return { acao: 'EXCLUIR' }
  return undefined
}

export const areasController = {
  async listar(req: Request, res: Response) {
    res.json(await new ListarAreas(areaRepositorio(req)).execute(req.usuario!.id))
  },

  async criar(req: Request, res: Response) {
    const area = await new CriarArea(areaRepositorio(req)).execute(req.usuario!.id, req.body)
    res.status(201).json(area)
  },

  async atualizar(req: Request, res: Response) {
    const area = await new AtualizarArea(areaRepositorio(req)).execute(req.usuario!.id, req.params.id, req.body)
    res.json(area)
  },

  async remover(req: Request, res: Response) {
    await new RemoverArea(areaRepositorio(req), reservaDeFechamento(req)).execute(req.usuario!.id, req.params.id, destinoDasTarefas(req))
    res.status(204).send()
  },
}
