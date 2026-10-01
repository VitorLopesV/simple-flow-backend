import type { Request, Response } from 'express'

import { ObterLimitesNavegacao } from '../../../application/use-cases/navegacao/ObterLimitesNavegacao'
import { SupabaseNavegacaoRepository } from '../../../infrastructure/supabase/repositories/SupabaseNavegacaoRepository'

export const navegacaoController = {
  async limites(req: Request, res: Response) {
    const navegacaoRepository = new SupabaseNavegacaoRepository(req.supabase!)

    const limites = await new ObterLimitesNavegacao(navegacaoRepository).execute(req.usuario!.id)
    res.json(limites)
  },
}
