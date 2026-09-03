import type { Request, Response } from 'express'

import { AtualizarCartao } from '../../../application/use-cases/cartoes/AtualizarCartao'
import { AtualizarTransacaoCartao } from '../../../application/use-cases/cartoes/AtualizarTransacaoCartao'
import { CriarCartao } from '../../../application/use-cases/cartoes/CriarCartao'
import { CriarTransacaoCartao } from '../../../application/use-cases/cartoes/CriarTransacaoCartao'
import { ListarCartoes } from '../../../application/use-cases/cartoes/ListarCartoes'
import { ListarFaturasDoCartao } from '../../../application/use-cases/cartoes/ListarFaturasDoCartao'
import { PagarFatura } from '../../../application/use-cases/cartoes/PagarFatura'
import { RemoverCartao } from '../../../application/use-cases/cartoes/RemoverCartao'
import { RemoverTransacaoCartao } from '../../../application/use-cases/cartoes/RemoverTransacaoCartao'
import { SupabaseCartaoRepository } from '../../../infrastructure/supabase/repositories/SupabaseCartaoRepository'
import { SupabaseFaturaRepository } from '../../../infrastructure/supabase/repositories/SupabaseFaturaRepository'

function cartaoRepositorio(req: Request) {
  return new SupabaseCartaoRepository(req.supabase!)
}

function faturaRepositorio(req: Request) {
  return new SupabaseFaturaRepository(req.supabase!)
}

export const cartoesController = {
  async listar(req: Request, res: Response) {
    const cartoes = await new ListarCartoes(cartaoRepositorio(req)).execute(req.usuario!.id)
    res.json(cartoes)
  },

  async listarComFaturas(req: Request, res: Response) {
    const { competencia, cartaoId } = req.query as unknown as { competencia: string; cartaoId?: string }
    const [ano, mes] = competencia.split('-').map(Number)

    const resultado = await new ListarFaturasDoCartao(faturaRepositorio(req)).execute(req.usuario!.id, {
      periodo: { mes, ano },
      cartaoId,
    })
    res.json(resultado)
  },

  async criar(req: Request, res: Response) {
    const cartao = await new CriarCartao(cartaoRepositorio(req)).execute(req.usuario!.id, req.body)
    res.status(201).json(cartao)
  },

  async atualizar(req: Request, res: Response) {
    const cartao = await new AtualizarCartao(cartaoRepositorio(req)).execute(req.usuario!.id, req.params.id, req.body)
    res.json(cartao)
  },

  async remover(req: Request, res: Response) {
    await new RemoverCartao(cartaoRepositorio(req)).execute(req.usuario!.id, req.params.id)
    res.status(204).send()
  },

  async pagarFatura(req: Request, res: Response) {
    await new PagarFatura(faturaRepositorio(req)).execute(req.usuario!.id, req.params.id)
    res.status(204).send()
  },

  async criarTransacao(req: Request, res: Response) {
    const criar = new CriarTransacaoCartao(cartaoRepositorio(req), faturaRepositorio(req))
    const transacao = await criar.execute(req.usuario!.id, req.params.cartaoId, req.body)
    res.status(201).json(transacao)
  },

  async atualizarTransacao(req: Request, res: Response) {
    const atualizar = new AtualizarTransacaoCartao(cartaoRepositorio(req), faturaRepositorio(req))
    const transacao = await atualizar.execute(req.usuario!.id, req.params.id, req.body)
    res.json(transacao)
  },

  async removerTransacao(req: Request, res: Response) {
    await new RemoverTransacaoCartao(faturaRepositorio(req)).execute(req.usuario!.id, req.params.id)
    res.status(204).send()
  },
}
