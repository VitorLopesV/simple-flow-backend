import type { Request, Response } from 'express'

import { AtualizarEntrada } from '../../../application/use-cases/entradas/AtualizarEntrada'
import { CriarEntrada } from '../../../application/use-cases/entradas/CriarEntrada'
import { ListarEntradas } from '../../../application/use-cases/entradas/ListarEntradas'
import { RemoverEntrada } from '../../../application/use-cases/entradas/RemoverEntrada'
import { ResumoEntradas } from '../../../application/use-cases/entradas/ResumoEntradas'
import { SupabaseEntradaRepository } from '../../../infrastructure/supabase/repositories/SupabaseEntradaRepository'
import { paraPeriodo } from '../../../shared/utils/periodo'

function repositorio(req: Request) {
  return new SupabaseEntradaRepository(req.supabase!)
}

export const entradasController = {
  async listar(req: Request, res: Response) {
    const { mes, ano, categoriaId, busca, page, pageSize } = req.query as unknown as {
      mes: number
      ano: number
      categoriaId?: string
      busca?: string
      page: number
      pageSize: number
    }

    const resultado = await new ListarEntradas(repositorio(req)).execute(req.usuario!.id, {
      periodo: { mes, ano },
      categoriaId,
      busca,
      page,
      pageSize,
    })
    res.json(resultado)
  },

  async resumo(req: Request, res: Response) {
    const { competencia } = req.query as unknown as { competencia: string }
    const resumo = await new ResumoEntradas(repositorio(req)).execute(req.usuario!.id, paraPeriodo(competencia))
    res.json(resumo)
  },

  async criar(req: Request, res: Response) {
    const entrada = await new CriarEntrada(repositorio(req)).execute(req.usuario!.id, req.body)
    res.status(201).json(entrada)
  },

  async atualizar(req: Request, res: Response) {
    const entrada = await new AtualizarEntrada(repositorio(req)).execute(req.usuario!.id, req.params.id, req.body)
    res.json(entrada)
  },

  async remover(req: Request, res: Response) {
    await new RemoverEntrada(repositorio(req)).execute(req.usuario!.id, req.params.id)
    res.status(204).send()
  },
}
