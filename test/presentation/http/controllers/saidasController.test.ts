import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConflictError, NotFoundError } from '../../../../src/domain/errors/DomainError'
import { saidasController } from '../../../../src/presentation/http/controllers/saidasController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => {
  const useCase = () => {
    const execute = vi.fn()
    return { execute, Classe: vi.fn(function () { return { execute } }) }
  }
  return {
    Repositorio: vi.fn(function (client: unknown) { return { repositorio: 'saidas', client } }),
    listar: useCase(),
    resumo: useCase(),
    criar: useCase(),
    atualizar: useCase(),
    remover: useCase(),
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseSaidaRepository', () => ({
  SupabaseSaidaRepository: m.Repositorio,
}))
vi.mock('../../../../src/application/use-cases/saidas/ListarSaidas', () => ({ ListarSaidas: m.listar.Classe }))
vi.mock('../../../../src/application/use-cases/saidas/ResumoSaidas', () => ({ ResumoSaidas: m.resumo.Classe }))
vi.mock('../../../../src/application/use-cases/saidas/CriarSaida', () => ({ CriarSaida: m.criar.Classe }))
vi.mock('../../../../src/application/use-cases/saidas/AtualizarSaida', () => ({ AtualizarSaida: m.atualizar.Classe }))
vi.mock('../../../../src/application/use-cases/saidas/RemoverSaida', () => ({ RemoverSaida: m.remover.Classe }))

const ID = '123e4567-e89b-12d3-a456-426614174000'
const SAIDA = { id: ID, descricao: 'Aluguel', valor: 1500 }
const PAYLOAD = {
  descricao: 'Aluguel',
  valor: 1500,
  data: '2026-08-05',
  categoriaId: 'cat-1',
  tipo: 'CONTA',
  status: 'PENDENTE',
  formaPagamento: 'PIX',
  recorrente: false,
}

function esperarComposicao(Classe: typeof m.listar.Classe, req: ReturnType<typeof criarRequisicao>) {
  expect(m.Repositorio).toHaveBeenCalledWith(req.supabase)
  expect(Classe).toHaveBeenCalledWith(m.Repositorio.mock.results[0]!.value)
}

describe('saidasController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listar', () => {
    it('monta o filtro a partir da query, incluindo a situação, e responde com a página', async () => {
      const pagina = { items: [SAIDA], page: 1, pageSize: 20, total: 1, totalPages: 1 }
      m.listar.execute.mockResolvedValue(pagina)
      const req = criarRequisicao({
        query: { mes: 8, ano: 2026, categoriaId: 'cat-1', status: 'PAGO', busca: 'alu', page: 1, pageSize: 20 },
      })
      const res = criarResposta()

      await saidasController.listar(req, res)

      esperarComposicao(m.listar.Classe, req)
      expect(m.listar.execute).toHaveBeenCalledWith(USUARIO.id, {
        periodo: { mes: 8, ano: 2026 },
        categoriaId: 'cat-1',
        status: 'PAGO',
        busca: 'alu',
        page: 1,
        pageSize: 20,
      })
      expect(res.json).toHaveBeenCalledWith(pagina)
    })

    it('propaga o erro do use-case sem responder', async () => {
      const erro = new Error('falha')
      m.listar.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(saidasController.listar(criarRequisicao({ query: { mes: 8, ano: 2026 } }), res)).rejects.toBe(erro)
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('resumo', () => {
    it('converte a competência em período e responde com o resumo', async () => {
      const resumo = { total: 1500, porTipo: [{ tipo: 'CONTA', total: 1500 }] }
      m.resumo.execute.mockResolvedValue(resumo)
      const req = criarRequisicao({ query: { competencia: '2025-12' } })
      const res = criarResposta()

      await saidasController.resumo(req, res)

      esperarComposicao(m.resumo.Classe, req)
      expect(m.resumo.execute).toHaveBeenCalledWith(USUARIO.id, { mes: 12, ano: 2025 })
      expect(res.json).toHaveBeenCalledWith(resumo)
    })

    it('propaga o erro do use-case sem responder', async () => {
      const erro = new Error('falha')
      m.resumo.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(saidasController.resumo(criarRequisicao({ query: { competencia: '2026-08' } }), res)).rejects.toBe(erro)
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('criar', () => {
    it('cria com o body e responde 201 com a saída', async () => {
      m.criar.execute.mockResolvedValue(SAIDA)
      const req = criarRequisicao({ body: PAYLOAD })
      const res = criarResposta()

      await saidasController.criar(req, res)

      esperarComposicao(m.criar.Classe, req)
      expect(m.criar.execute).toHaveBeenCalledWith(USUARIO.id, PAYLOAD)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(SAIDA)
    })

    it('propaga o erro do use-case sem responder', async () => {
      const erro = new Error('falha')
      m.criar.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(saidasController.criar(criarRequisicao({ body: PAYLOAD }), res)).rejects.toBe(erro)
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('atualizar', () => {
    it('atualiza pelo id do path com o body e responde com a saída', async () => {
      m.atualizar.execute.mockResolvedValue(SAIDA)
      const req = criarRequisicao({ params: { id: ID }, body: PAYLOAD })
      const res = criarResposta()

      await saidasController.atualizar(req, res)

      esperarComposicao(m.atualizar.Classe, req)
      expect(m.atualizar.execute).toHaveBeenCalledWith(USUARIO.id, ID, PAYLOAD)
      expect(res.json).toHaveBeenCalledWith(SAIDA)
    })

    it('propaga o ConflictError de saída automática sem responder', async () => {
      const erro = new ConflictError('automática')
      m.atualizar.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(saidasController.atualizar(criarRequisicao({ params: { id: ID }, body: PAYLOAD }), res)).rejects.toBe(erro)
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('remover', () => {
    it('remove pelo id do path e responde 204 sem corpo', async () => {
      m.remover.execute.mockResolvedValue(undefined)
      const req = criarRequisicao({ params: { id: ID } })
      const res = criarResposta()

      await saidasController.remover(req, res)

      esperarComposicao(m.remover.Classe, req)
      expect(m.remover.execute).toHaveBeenCalledWith(USUARIO.id, ID)
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.send).toHaveBeenCalledWith()
    })

    it('propaga o NotFoundError do use-case sem responder', async () => {
      const erro = new NotFoundError('Saída')
      m.remover.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(saidasController.remover(criarRequisicao({ params: { id: ID } }), res)).rejects.toBe(erro)
      expect(res.status).not.toHaveBeenCalled()
    })
  })
})
