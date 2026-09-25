import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import type { Request, Response } from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from '../../../../src/app'
import { NotFoundError, UnauthorizedError } from '../../../../src/domain/errors/DomainError'

/**
 * Sobe a aplicação real (createApp → routes → routers → authMiddleware/validate/asyncHandler
 * → errorHandler) numa porta efêmera, trocando só as bordas: env, validação do token no
 * Supabase Auth e os controllers — cada ação do controller responde com o próprio nome
 * e com o que recebeu, para o teste saber qual handler a rota alcançou.
 */
const m = vi.hoisted(() => {
  const controller = (nome: string, acoes: string[]) =>
    Object.fromEntries(
      acoes.map((acao) => [
        acao,
        vi.fn(async (req: Request, res: Response) => {
          res.json({ acao: `${nome}.${acao}`, body: req.body, query: req.query, params: req.params })
        }),
      ]),
    )

  return {
    obterUsuarioPorToken: vi.fn(),
    supabaseClientForRequest: vi.fn(() => ({ cliente: 'supabase-da-requisicao' })),
    auth: controller('auth', ['registrar', 'login', 'refresh', 'me']),
    categorias: controller('categorias', ['listar']),
    entradas: controller('entradas', ['listar', 'resumo', 'criar', 'atualizar', 'remover']),
    saidas: controller('saidas', ['listar', 'resumo', 'criar', 'atualizar', 'remover']),
    cartoes: controller('cartoes', [
      'listar',
      'listarComFaturas',
      'criar',
      'atualizar',
      'remover',
      'pagarFatura',
      'criarTransacao',
      'atualizarTransacao',
      'removerTransacao',
    ]),
    dashboard: controller('dashboard', ['resumo']),
  }
})

vi.mock('../../../../src/infrastructure/config/env', () => ({ env: { corsOrigins: ['http://localhost:5173'] } }))
vi.mock('../../../../src/infrastructure/auth/SupabaseAuthService', () => ({
  SupabaseAuthService: { obterUsuarioPorToken: m.obterUsuarioPorToken },
}))
vi.mock('../../../../src/infrastructure/supabase/supabaseClientForRequest', () => ({
  supabaseClientForRequest: m.supabaseClientForRequest,
}))
vi.mock('../../../../src/presentation/http/controllers/authController', () => ({ authController: m.auth }))
vi.mock('../../../../src/presentation/http/controllers/categoriasController', () => ({ categoriasController: m.categorias }))
vi.mock('../../../../src/presentation/http/controllers/entradasController', () => ({ entradasController: m.entradas }))
vi.mock('../../../../src/presentation/http/controllers/saidasController', () => ({ saidasController: m.saidas }))
vi.mock('../../../../src/presentation/http/controllers/cartoesController', () => ({ cartoesController: m.cartoes }))
vi.mock('../../../../src/presentation/http/controllers/dashboardController', () => ({ dashboardController: m.dashboard }))

const UUID = '123e4567-e89b-12d3-a456-426614174000'
const UUID_2 = '223e4567-e89b-12d3-a456-426614174000'
const USUARIO = { id: 'user-1', email: 'ana@exemplo.com', nome: 'Ana' }

const ENTRADA = { descricao: 'Salário', valor: 5000, data: '2026-08-05', categoriaId: UUID, recorrente: false }
const SAIDA = {
  descricao: 'Aluguel',
  valor: 1500,
  data: '2026-08-05',
  categoriaId: UUID,
  tipo: 'CONTA',
  status: 'PENDENTE',
  formaPagamento: 'PIX',
  recorrente: false,
}
const CARTAO = {
  nome: 'Nubank',
  bandeira: 'MASTERCARD',
  ultimosDigitos: '1234',
  limite: 5000,
  diaFechamento: 10,
  diaVencimento: 20,
  cor: '#820ad1',
  ativo: true,
}
const TRANSACAO = {
  descricao: 'Mercado',
  valor: 200,
  data: '2026-08-15',
  categoriaId: UUID,
  tipo: 'ALIMENTACAO',
  recorrente: false,
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface Rota {
  metodo: Metodo
  caminho: string
  acao: string
  body?: unknown
}

const ROTAS_PUBLICAS: Rota[] = [
  { metodo: 'POST', caminho: '/api/auth/registro', acao: 'auth.registrar', body: { email: 'ana@exemplo.com', senha: 'segredo', nome: 'Ana' } },
  { metodo: 'POST', caminho: '/api/auth/login', acao: 'auth.login', body: { email: 'ana@exemplo.com', senha: 'segredo' } },
  { metodo: 'POST', caminho: '/api/auth/refresh', acao: 'auth.refresh', body: { refreshToken: 'refresh' } },
]

const ROTAS_PROTEGIDAS: Rota[] = [
  { metodo: 'GET', caminho: '/api/auth/me', acao: 'auth.me' },
  { metodo: 'GET', caminho: '/api/categorias', acao: 'categorias.listar' },
  { metodo: 'GET', caminho: '/api/entradas/resumo?competencia=2026-08', acao: 'entradas.resumo' },
  { metodo: 'GET', caminho: '/api/entradas?mes=8&ano=2026', acao: 'entradas.listar' },
  { metodo: 'POST', caminho: '/api/entradas', acao: 'entradas.criar', body: ENTRADA },
  { metodo: 'PUT', caminho: `/api/entradas/${UUID}`, acao: 'entradas.atualizar', body: ENTRADA },
  { metodo: 'DELETE', caminho: `/api/entradas/${UUID}`, acao: 'entradas.remover' },
  { metodo: 'GET', caminho: '/api/saidas/resumo?competencia=2026-08', acao: 'saidas.resumo' },
  { metodo: 'GET', caminho: '/api/saidas?mes=8&ano=2026', acao: 'saidas.listar' },
  { metodo: 'POST', caminho: '/api/saidas', acao: 'saidas.criar', body: SAIDA },
  { metodo: 'PUT', caminho: `/api/saidas/${UUID}`, acao: 'saidas.atualizar', body: SAIDA },
  { metodo: 'DELETE', caminho: `/api/saidas/${UUID}`, acao: 'saidas.remover' },
  { metodo: 'GET', caminho: '/api/cartoes/faturas?competencia=2026-08', acao: 'cartoes.listarComFaturas' },
  { metodo: 'POST', caminho: `/api/cartoes/${UUID}/transacoes`, acao: 'cartoes.criarTransacao', body: TRANSACAO },
  { metodo: 'PUT', caminho: `/api/cartoes/${UUID}/transacoes/${UUID_2}`, acao: 'cartoes.atualizarTransacao', body: TRANSACAO },
  { metodo: 'DELETE', caminho: `/api/cartoes/${UUID}/transacoes/${UUID_2}`, acao: 'cartoes.removerTransacao' },
  { metodo: 'GET', caminho: '/api/cartoes', acao: 'cartoes.listar' },
  { metodo: 'POST', caminho: '/api/cartoes', acao: 'cartoes.criar', body: CARTAO },
  { metodo: 'PUT', caminho: `/api/cartoes/${UUID}`, acao: 'cartoes.atualizar', body: CARTAO },
  { metodo: 'DELETE', caminho: `/api/cartoes/${UUID}`, acao: 'cartoes.remover' },
  { metodo: 'PATCH', caminho: `/api/faturas/${UUID}/pagar`, acao: 'cartoes.pagarFatura' },
  { metodo: 'GET', caminho: '/api/dashboard/resumo?competencia=2026-08', acao: 'dashboard.resumo' },
]

/** Entrada inválida por rota validada, com a mensagem que o schema devolve (quando é uma mensagem própria). */
const ENTRADAS_INVALIDAS: (Omit<Rota, 'acao'> & { mensagem?: string })[] = [
  { metodo: 'POST', caminho: '/api/auth/registro', body: { email: 'ana', senha: 'segredo' }, mensagem: 'E-mail inválido.' },
  { metodo: 'POST', caminho: '/api/auth/login', body: { email: 'ana@exemplo.com', senha: '' }, mensagem: 'Informe a senha.' },
  { metodo: 'POST', caminho: '/api/auth/refresh', body: { refreshToken: '' }, mensagem: 'Informe o refresh token.' },
  { metodo: 'GET', caminho: '/api/entradas/resumo?competencia=08-2026', mensagem: 'Competência inválida, use o formato YYYY-MM.' },
  { metodo: 'GET', caminho: '/api/entradas?mes=13&ano=2026' },
  { metodo: 'POST', caminho: '/api/entradas', body: { ...ENTRADA, valor: -1 }, mensagem: 'O valor deve ser positivo.' },
  { metodo: 'PUT', caminho: '/api/entradas/abc', body: ENTRADA, mensagem: 'Identificador inválido.' },
  { metodo: 'PUT', caminho: `/api/entradas/${UUID}`, body: { ...ENTRADA, data: '05/08/2026' }, mensagem: 'Data inválida, use o formato YYYY-MM-DD.' },
  { metodo: 'DELETE', caminho: `/api/entradas/${UUID}_2026-08`, mensagem: 'Identificador inválido.' },
  { metodo: 'GET', caminho: '/api/saidas/resumo', },
  { metodo: 'GET', caminho: '/api/saidas?mes=8&ano=2026&status=ATRASADO' },
  {
    metodo: 'POST',
    caminho: '/api/saidas',
    body: { ...SAIDA, formaPagamento: 'CARTAO_CREDITO' },
    mensagem: 'Gastos no cartão de crédito devem ser lançados na aba Cartões.',
  },
  { metodo: 'PUT', caminho: '/api/saidas/abc', body: SAIDA, mensagem: 'Identificador inválido.' },
  { metodo: 'PUT', caminho: `/api/saidas/${UUID}`, body: { ...SAIDA, categoriaId: 'x' }, mensagem: 'Categoria inválida.' },
  { metodo: 'DELETE', caminho: '/api/saidas/abc', mensagem: 'Identificador inválido.' },
  { metodo: 'GET', caminho: '/api/cartoes/faturas?competencia=2026-8', mensagem: 'Competência inválida, use o formato YYYY-MM.' },
  { metodo: 'POST', caminho: '/api/cartoes/abc/transacoes', body: TRANSACAO, mensagem: 'Cartão inválido.' },
  { metodo: 'POST', caminho: `/api/cartoes/${UUID}/transacoes`, body: { ...TRANSACAO, valor: 0 }, mensagem: 'O valor deve ser positivo.' },
  { metodo: 'PUT', caminho: `/api/cartoes/${UUID}/transacoes/abc`, body: TRANSACAO, mensagem: 'Identificador inválido.' },
  { metodo: 'PUT', caminho: `/api/cartoes/${UUID}/transacoes/${UUID_2}`, body: { ...TRANSACAO, descricao: '' }, mensagem: 'Informe a descrição.' },
  { metodo: 'DELETE', caminho: `/api/cartoes/abc/transacoes/${UUID_2}`, mensagem: 'Cartão inválido.' },
  { metodo: 'POST', caminho: '/api/cartoes', body: { ...CARTAO, ultimosDigitos: '12' }, mensagem: 'Informe os 4 últimos dígitos.' },
  { metodo: 'PUT', caminho: '/api/cartoes/abc', body: CARTAO, mensagem: 'Identificador inválido.' },
  { metodo: 'PUT', caminho: `/api/cartoes/${UUID}`, body: { ...CARTAO, limite: -1 }, mensagem: 'O limite não pode ser negativo.' },
  { metodo: 'DELETE', caminho: '/api/cartoes/abc', mensagem: 'Identificador inválido.' },
  { metodo: 'PATCH', caminho: '/api/faturas/abc/pagar', mensagem: 'Identificador inválido.' },
  { metodo: 'GET', caminho: '/api/dashboard/resumo?competencia=agosto', mensagem: 'Competência inválida, use o formato YYYY-MM.' },
]

const todasAsAcoes = () => [m.auth, m.categorias, m.entradas, m.saidas, m.cartoes, m.dashboard].flatMap(Object.values)

let servidor: Server
let baseUrl: string

async function requisitar(metodo: Metodo, caminho: string, { body, token = 'token-valido' }: { body?: unknown; token?: string | null } = {}) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const texto = await resposta.text()
  let corpo: unknown = texto
  try {
    corpo = JSON.parse(texto)
  } catch {
    // Respostas 404 padrão do Express são HTML.
  }
  return { status: resposta.status, corpo: corpo as Record<string, unknown> }
}

describe('rotas HTTP', () => {
  beforeAll(async () => {
    servidor = createApp().listen(0)
    await new Promise((resolve) => servidor.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise((resolve) => servidor.close(resolve))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    m.obterUsuarioPorToken.mockResolvedValue(USUARIO)
  })

  it('GET /api/health responde sem autenticação', async () => {
    const { status, corpo } = await requisitar('GET', '/api/health', { token: null })

    expect(status).toBe(200)
    expect(corpo).toEqual({ status: 'ok' })
  })

  describe('rotas públicas', () => {
    it.each(ROTAS_PUBLICAS)('$metodo $caminho alcança $acao sem token', async ({ metodo, caminho, acao, body }) => {
      const { status, corpo } = await requisitar(metodo, caminho, { body, token: null })

      expect(status).toBe(200)
      expect(corpo.acao).toBe(acao)
      expect(m.obterUsuarioPorToken).not.toHaveBeenCalled()
    })
  })

  describe('rotas protegidas', () => {
    it.each(ROTAS_PROTEGIDAS)('$metodo $caminho alcança $acao com token válido', async ({ metodo, caminho, acao, body }) => {
      const { status, corpo } = await requisitar(metodo, caminho, { body })

      expect(status).toBe(200)
      expect(corpo.acao).toBe(acao)
      expect(m.obterUsuarioPorToken).toHaveBeenCalledWith('token-valido')
      expect(m.supabaseClientForRequest).toHaveBeenCalledWith('token-valido')
    })

    it.each(ROTAS_PROTEGIDAS)('$metodo $caminho responde 401 sem token e não chama o controller', async ({ metodo, caminho, body }) => {
      const { status, corpo } = await requisitar(metodo, caminho, { body, token: null })

      expect(status).toBe(401)
      expect(corpo).toEqual({ message: 'Token de acesso ausente.' })
      for (const acao of todasAsAcoes()) expect(acao).not.toHaveBeenCalled()
    })

    it('responde 401 com token rejeitado pelo Supabase Auth', async () => {
      m.obterUsuarioPorToken.mockRejectedValue(new UnauthorizedError('Token inválido ou expirado.'))

      const { status, corpo } = await requisitar('GET', '/api/categorias', { token: 'expirado' })

      expect(status).toBe(401)
      expect(corpo).toEqual({ message: 'Token inválido ou expirado.' })
      expect(m.categorias.listar).not.toHaveBeenCalled()
    })

    it('autentica antes de validar: entrada inválida sem token ainda responde 401', async () => {
      const { status } = await requisitar('POST', '/api/entradas', { body: {}, token: null })

      expect(status).toBe(401)
    })
  })

  describe('validação de schema', () => {
    it.each(ENTRADAS_INVALIDAS)('$metodo $caminho responde 422 com entrada inválida', async ({ metodo, caminho, body, mensagem }) => {
      const { status, corpo } = await requisitar(metodo, caminho, { body })

      expect(status).toBe(422)
      expect(typeof corpo.message).toBe('string')
      if (mensagem) expect(corpo.message).toBe(mensagem)
      for (const acao of todasAsAcoes()) expect(acao).not.toHaveBeenCalled()
    })

    it('entrega ao controller a query já convertida e com os defaults do schema', async () => {
      const { corpo } = await requisitar('GET', '/api/entradas?mes=8&ano=2026&busca=sal')

      expect(corpo.query).toEqual({ mes: 8, ano: 2026, busca: 'sal', page: 1, pageSize: 20 })
    })

    it('entrega ao controller o body já parseado, com os defaults do schema', async () => {
      const { corpo } = await requisitar('POST', `/api/cartoes/${UUID}/transacoes`, { body: { ...TRANSACAO, extra: 'x' } })

      expect(corpo.body).toEqual({ ...TRANSACAO, parcelaAtual: 1, totalParcelas: 1 })
      expect(corpo.params).toEqual({ cartaoId: UUID })
    })

    it.each(['entradas', 'saidas'])('PUT /api/%s/:id aceita o id sintético de uma ocorrência projetada', async (recurso) => {
      const { status, corpo } = await requisitar('PUT', `/api/${recurso}/${UUID}_2026-08`, {
        body: recurso === 'entradas' ? ENTRADA : SAIDA,
      })

      expect(status).toBe(200)
      expect(corpo.params).toEqual({ id: `${UUID}_2026-08` })
    })
  })

  describe('métodos e caminhos', () => {
    it('GET /api/cartoes/faturas não é capturado pela rota /:id', async () => {
      const { corpo } = await requisitar('GET', '/api/cartoes/faturas?competencia=2026-08')

      expect(corpo.acao).toBe('cartoes.listarComFaturas')
    })

    it.each([
      ['PATCH', `/api/entradas/${UUID}`],
      ['POST', `/api/saidas/${UUID}`],
      ['GET', `/api/cartoes/${UUID}`],
      ['GET', `/api/faturas/${UUID}/pagar`],
      ['POST', '/api/dashboard/resumo?competencia=2026-08'],
      ['DELETE', '/api/categorias'],
      ['GET', '/api/auth/login'],
      ['GET', '/api/inexistente'],
    ] as [Metodo, string][])('%s %s não está registrada (404)', async (metodo, caminho) => {
      const { status } = await requisitar(metodo, caminho)

      expect(status).toBe(404)
      for (const acao of todasAsAcoes()) expect(acao).not.toHaveBeenCalled()
    })
  })

  describe('erros dos controllers', () => {
    it('repassa DomainError ao errorHandler via asyncHandler', async () => {
      m.entradas.remover!.mockRejectedValueOnce(new NotFoundError('Entrada'))

      const { status, corpo } = await requisitar('DELETE', `/api/entradas/${UUID}`)

      expect(status).toBe(404)
      expect(corpo).toEqual({ message: 'Entrada não encontrado.' })
    })

    it('responde 500 genérico para erro inesperado', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      m.dashboard.resumo!.mockRejectedValueOnce(new Error('boom'))

      const { status, corpo } = await requisitar('GET', '/api/dashboard/resumo?competencia=2026-08')

      expect(status).toBe(500)
      expect(corpo).toEqual({ message: 'Erro interno do servidor.' })
      consoleError.mockRestore()
    })
  })
})
