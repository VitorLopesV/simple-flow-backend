import type { Request, Response } from 'express'

import { AtualizarItemRotina } from '../../../application/use-cases/rotinas/AtualizarItemRotina'
import { CriarItemRotina } from '../../../application/use-cases/rotinas/CriarItemRotina'
import { ListarItensRotina } from '../../../application/use-cases/rotinas/ListarItensRotina'
import { RemoverItemRotina } from '../../../application/use-cases/rotinas/RemoverItemRotina'
import { SupabaseAreaRepository } from '../../../infrastructure/supabase/repositories/SupabaseAreaRepository'
import { SupabaseItemRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseItemRotinaRepository'

function itemRepositorio(req: Request) {
  return new SupabaseItemRotinaRepository(req.supabase!)
}

export const rotinasController = {
  async listar(req: Request, res: Response) {
    res.json(await new ListarItensRotina(itemRepositorio(req)).execute(req.usuario!.id))
  },

  async criar(req: Request, res: Response) {
    const item = await new CriarItemRotina(itemRepositorio(req), new SupabaseAreaRepository(req.supabase!)).execute(
      req.usuario!.id,
      req.body,
    )
    res.status(201).json(item)
  },

  async atualizar(req: Request, res: Response) {
    const item = await new AtualizarItemRotina(itemRepositorio(req)).execute(req.usuario!.id, req.params.id, req.body)
    res.json(item)
  },

  async remover(req: Request, res: Response) {
    await new RemoverItemRotina(itemRepositorio(req)).execute(req.usuario!.id, req.params.id)
    res.status(204).send()
  },
}
