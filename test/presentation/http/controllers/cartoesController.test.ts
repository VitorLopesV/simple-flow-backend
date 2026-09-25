import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { cartoesController } from '../../../../src/presentation/http/controllers/cartoesController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => {
  const useCase = () => {
    const execute = vi.fn()
    return { execute, Classe: vi.fn(function () { return { execute } }) }
  }
  return {
    RepositorioCartao: vi.fn(function (client: unknown) { return { repositorio: 'cartoes', client } }),
    RepositorioFatura: vi.fn(function (client: unknown) { return { repositorio: 'faturas', client } }),
    listar: useCase(),
    listarFaturas: useCase(),
    criar: useCase(),
    atualizar: useCase(),
    remover: useCase(),
    pagar: useCase(),
    criarTransacao: useCase(),
    atualizarTransacao: useCase(),
    removerTransacao: useCase(),
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseCartaoRepository', () => ({
  SupabaseCartaoRepository: m.RepositorioCartao,
}))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseFaturaRepository', () => ({
  SupabaseFaturaRepository: m.RepositorioFatura,
}))
vi.mock('../../../../src/application/use-cases/cartoes/ListarCartoes', () => ({ ListarCartoes: m.listar.Classe }))
vi.mock('../../../../src/application/use-cases/cartoes/ListarFaturasDoCartao', () => ({
  ListarFaturasDoCartao: m.listarFaturas.Classe,
}))
vi.mock('../../../../src/application/use-cases/cartoes/CriarCartao', () => ({ CriarCartao: m.criar.Classe }))
vi.mock('../../../../src/application/use-cases/cartoes/AtualizarCartao', () => ({ AtualizarCartao: m.atualizar.Classe }))
vi.mock('../../../../src/application/use-cases/cartoes/RemoverCartao', () => ({ RemoverCartao: m.remover.Classe }))
vi.mock('../../../../src/application/use-cases/cartoes/PagarFatura', () => ({ PagarFatura: m.pagar.Classe }))
vi.mock('../../../../src/application/use-cases/cartoes/CriarTransacaoCartao', () => ({
  CriarTransacaoCartao: m.criarTransacao.Classe,
}))
vi.mock('../../../../src/application/use-cases/cartoes/AtualizarTransacaoCartao', () => ({
  AtualizarTransacaoCartao: m.atualizarTransacao.Classe,
}))
vi.mock('../../../../src/application/use-cases/cartoes/RemoverTransacaoCartao', () => ({
  RemoverTransacaoCartao: m.removerTransacao.Classe,
}))

const ID = '123e4567-e89b-12d3-a456-426614174000'
const CARTAO_ID = '223e4567-e89b-12d3-a456-426614174000'
const CARTAO = { id: CARTAO_ID, nome: 'Nubank' }
const CARTAO_PAYLOAD = {
  nome: 'Nubank',
  bandeira: 'MASTERCARD',
  ultimosDigitos: '1234',
  limite: 5000,
  diaFechamento: 10,
  diaVencimento: 20,
  cor: '#820ad1',
  ativo: true,
}
const TRANSACAO = { id: ID, cartaoId: CARTAO_ID, descricao: 'Mercado', valor: 200 }
const TRANSACAO_PAYLOAD = {
  descricao: 'Mercado',
  valor: 200,
  data: '2026-08-15',
  categoriaId: 'cat-1',
  tipo: 'ALIMENTACAO',
  parcelaAtual: 1,
  totalParcelas: 1,
  recorrente: false,
}

function repositorioCartaoCriado() {
  return m.RepositorioCartao.mock.results[0]!.value
}

function repositorioFaturaCriado() {
  return m.RepositorioFatura.mock.results[0]!.value
}

describe('cartoesController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CRUD de cartões (repositório de cartões)', () => {
    it('listar: responde com os cartões do usuário', async () => {
      m.listar.execute.mockResolvedValue([CARTAO])
      const req = criarRequisicao()
      const res = criarResposta()

      await cartoesController.listar(req, res)

      expect(m.RepositorioCartao).toHaveBeenCalledWith(req.supabase)
      expect(m.listar.Classe).toHaveBeenCalledWith(repositorioCartaoCriado())
      expect(m.listar.execute).toHaveBeenCalledWith(USUARIO.id)
      expect(res.json).toHaveBeenCalledWith([CARTAO])
    })

    it('criar: cria com o body e responde 201', async () => {
      m.criar.execute.mockResolvedValue(CARTAO)
      const req = criarRequisicao({ body: CARTAO_PAYLOAD })
      const res = criarResposta()

      await cartoesController.criar(req, res)

      expect(m.criar.Classe).toHaveBeenCalledWith(repositorioCartaoCriado())
      expect(m.criar.execute).toHaveBeenCalledWith(USUARIO.id, CARTAO_PAYLOAD)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(CARTAO)
    })

    it('atualizar: atualiza pelo id do path e responde com o cartão', async () => {
      m.atualizar.execute.mockResolvedValue(CARTAO)
      const req = criarRequisicao({ params: { id: CARTAO_ID }, body: CARTAO_PAYLOAD })
      const res = criarResposta()

      await cartoesController.atualizar(req, res)

      expect(m.atualizar.Classe).toHaveBeenCalledWith(repositorioCartaoCriado())
      expect(m.atualizar.execute).toHaveBeenCalledWith(USUARIO.id, CARTAO_ID, CARTAO_PAYLOAD)
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(CARTAO)
    })

    it('remover: remove pelo id do path e responde 204', async () => {
      m.remover.execute.mockResolvedValue(undefined)
      const req = criarRequisicao({ params: { id: CARTAO_ID } })
      const res = criarResposta()

      await cartoesController.remover(req, res)

      expect(m.remover.Classe).toHaveBeenCalledWith(repositorioCartaoCriado())
      expect(m.remover.execute).toHaveBeenCalledWith(USUARIO.id, CARTAO_ID)
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.send).toHaveBeenCalledWith()
    })

    it.each([
      ['listar', m.listar, () => criarRequisicao()],
      ['criar', m.criar, () => criarRequisicao({ body: CARTAO_PAYLOAD })],
      ['atualizar', m.atualizar, () => criarRequisicao({ params: { id: CARTAO_ID }, body: CARTAO_PAYLOAD })],
      ['remover', m.remover, () => criarRequisicao({ params: { id: CARTAO_ID } })],
    ] as const)('%s: propaga o erro do use-case sem responder', async (acao, useCase, requisicao) => {
      const erro = new NotFoundError('Cartão')
      useCase.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(cartoesController[acao](requisicao(), res)).rejects.toBe(erro)
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('faturas (repositório de faturas)', () => {
    it('listarComFaturas: converte a competência em período e repassa o filtro de cartão', async () => {
      const resultado = [{ cartao: CARTAO, fatura: null, usoLimite: 0 }]
      m.listarFaturas.execute.mockResolvedValue(resultado)
      const req = criarRequisicao({ query: { competencia: '2026-08', cartaoId: CARTAO_ID } })
      const res = criarResposta()

      await cartoesController.listarComFaturas(req, res)

      expect(m.RepositorioFatura).toHaveBeenCalledWith(req.supabase)
      expect(m.listarFaturas.Classe).toHaveBeenCalledWith(repositorioFaturaCriado())
      expect(m.listarFaturas.execute).toHaveBeenCalledWith(USUARIO.id, {
        periodo: { mes: 8, ano: 2026 },
        cartaoId: CARTAO_ID,
      })
      expect(res.json).toHaveBeenCalledWith(resultado)
    })

    it('listarComFaturas: sem cartaoId, repassa undefined', async () => {
      m.listarFaturas.execute.mockResolvedValue([])

      await cartoesController.listarComFaturas(criarRequisicao({ query: { competencia: '2026-01' } }), criarResposta())

      expect(m.listarFaturas.execute).toHaveBeenCalledWith(USUARIO.id, { periodo: { mes: 1, ano: 2026 }, cartaoId: undefined })
    })

    it('pagarFatura: paga pelo id do path e responde 204', async () => {
      m.pagar.execute.mockResolvedValue(undefined)
      const req = criarRequisicao({ params: { id: ID } })
      const res = criarResposta()

      await cartoesController.pagarFatura(req, res)

      expect(m.pagar.Classe).toHaveBeenCalledWith(repositorioFaturaCriado())
      expect(m.pagar.execute).toHaveBeenCalledWith(USUARIO.id, ID)
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.send).toHaveBeenCalledWith()
    })

    it('removerTransacao: remove pelo id do path e responde 204', async () => {
      m.removerTransacao.execute.mockResolvedValue(undefined)
      const req = criarRequisicao({ params: { cartaoId: CARTAO_ID, id: ID } })
      const res = criarResposta()

      await cartoesController.removerTransacao(req, res)

      expect(m.removerTransacao.Classe).toHaveBeenCalledWith(repositorioFaturaCriado())
      expect(m.removerTransacao.execute).toHaveBeenCalledWith(USUARIO.id, ID)
      expect(res.status).toHaveBeenCalledWith(204)
    })
  })

  describe('transações (repositórios de cartões e de faturas)', () => {
    it('criarTransacao: lança no cartão do path e responde 201', async () => {
      m.criarTransacao.execute.mockResolvedValue(TRANSACAO)
      const req = criarRequisicao({ params: { cartaoId: CARTAO_ID }, body: TRANSACAO_PAYLOAD })
      const res = criarResposta()

      await cartoesController.criarTransacao(req, res)

      expect(m.RepositorioCartao).toHaveBeenCalledWith(req.supabase)
      expect(m.RepositorioFatura).toHaveBeenCalledWith(req.supabase)
      expect(m.criarTransacao.Classe).toHaveBeenCalledWith(repositorioCartaoCriado(), repositorioFaturaCriado())
      expect(m.criarTransacao.execute).toHaveBeenCalledWith(USUARIO.id, CARTAO_ID, TRANSACAO_PAYLOAD)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(TRANSACAO)
    })

    it('atualizarTransacao: atualiza pelo id da transação e responde com ela', async () => {
      m.atualizarTransacao.execute.mockResolvedValue(TRANSACAO)
      const req = criarRequisicao({ params: { cartaoId: CARTAO_ID, id: ID }, body: TRANSACAO_PAYLOAD })
      const res = criarResposta()

      await cartoesController.atualizarTransacao(req, res)

      expect(m.atualizarTransacao.Classe).toHaveBeenCalledWith(repositorioCartaoCriado(), repositorioFaturaCriado())
      expect(m.atualizarTransacao.execute).toHaveBeenCalledWith(USUARIO.id, ID, TRANSACAO_PAYLOAD)
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(TRANSACAO)
    })
  })

  it.each([
    ['listarComFaturas', m.listarFaturas, () => criarRequisicao({ query: { competencia: '2026-08' } })],
    ['pagarFatura', m.pagar, () => criarRequisicao({ params: { id: ID } })],
    ['criarTransacao', m.criarTransacao, () => criarRequisicao({ params: { cartaoId: CARTAO_ID }, body: TRANSACAO_PAYLOAD })],
    [
      'atualizarTransacao',
      m.atualizarTransacao,
      () => criarRequisicao({ params: { cartaoId: CARTAO_ID, id: ID }, body: TRANSACAO_PAYLOAD }),
    ],
    ['removerTransacao', m.removerTransacao, () => criarRequisicao({ params: { cartaoId: CARTAO_ID, id: ID } })],
  ] as const)('%s: propaga o erro do use-case sem responder', async (acao, useCase, requisicao) => {
    const erro = new NotFoundError('Cartão')
    useCase.execute.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(cartoesController[acao](requisicao(), res)).rejects.toBe(erro)
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })
})
