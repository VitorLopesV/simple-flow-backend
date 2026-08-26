import type { Request, Response } from 'express'

import { AtualizarSaida } from '../../../application/use-cases/saidas/AtualizarSaida'
import { CriarSaida } from '../../../application/use-cases/saidas/CriarSaida'
import { ListarSaidas } from '../../../application/use-cases/saidas/ListarSaidas'
import { RemoverSaida } from '../../../application/use-cases/saidas/RemoverSaida'
import { ResumoSaidas } from '../../../application/use-cases/saidas/ResumoSaidas'
import { SupabaseCartaoRepository } from '../../../infrastructure/supabase/repositories/SupabaseCartaoRepository'
import { SupabaseFaturaRepository } from '../../../infrastructure/supabase/repositories/SupabaseFaturaRepository'
import { SupabaseSaidaRepository } from '../../../infrastructure/supabase/repositories/SupabaseSaidaRepository'
import type { SaidaStatus } from '../../../domain/entities/Saida'
import { paraPeriodo } from '../../../shared/utils/periodo'

function repositorio(req: Request) {
  return new SupabaseSaidaRepository(req.supabase!)
}

export const saidasController = {
  async listar(req: Request, res: Response) {
    const { mes, ano, categoriaId, status, busca, page, pageSize } = req.query as unknown as {
      mes: number
      ano: number
      categoriaId?: string
      status?: SaidaStatus
      busca?: string
      page: number
      pageSize: number
    }

    const resultado = await new ListarSaidas(repositorio(req)).execute(req.usuario!.id, {
      periodo: { mes, ano },
      categoriaId,
      status,
      busca,
      page,
      pageSize,
    })
    res.json(resultado)
  },

  async resumo(req: Request, res: Response) {
    const { competencia } = req.query as unknown as { competencia: string }
    const resumo = await new ResumoSaidas(repositorio(req)).execute(req.usuario!.id, paraPeriodo(competencia))
    res.json(resumo)
  },

  async criar(req: Request, res: Response) {
    const criarSaida = new CriarSaida(
      repositorio(req),
      new SupabaseCartaoRepository(req.supabase!),
      new SupabaseFaturaRepository(req.supabase!),
    )
    const saida = await criarSaida.execute(req.usuario!.id, req.body)
    res.status(201).json(saida)
  },

  async atualizar(req: Request, res: Response) {
    const saida = await new AtualizarSaida(repositorio(req)).execute(req.usuario!.id, req.params.id, req.body)
    res.json(saida)
  },

  async remover(req: Request, res: Response) {
    await new RemoverSaida(repositorio(req)).execute(req.usuario!.id, req.params.id)
    res.status(204).send()
  },
}
