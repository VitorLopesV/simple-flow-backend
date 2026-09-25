import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { entradasController } from '../../../../src/presentation/http/controllers/entradasController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => {
  const useCase = () => {
    const execute = vi.fn()
    return { execute, Classe: vi.fn(function () { return { execute } }) }
  }
  return {
    Repositorio: vi.fn(function (client: unknown) { return { repositorio: 'entradas', client } }),
    listar: useCase(),
    resumo: useCase(),
    criar: useCase(),
    atualizar: useCase(),
    remover: useCase(),
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseEntradaRepository', () => ({
  SupabaseEntradaRepository: m.Repositorio,
}))
vi.mock('../../../../src/application/use-cases/entradas/ListarEntradas', () => ({ ListarEntradas: m.listar.Classe }))
vi.mock('../../../../src/application/use-cases/entradas/ResumoEntradas', () => ({ ResumoEntradas: m.resumo.Classe }))
vi.mock('../../../../src/application/use-cases/entradas/CriarEntrada', () => ({ CriarEntrada: m.criar.Classe }))
vi.mock('../../../../src/application/use-cases/entradas/AtualizarEntrada', () => ({ AtualizarEntrada: m.atualizar.Classe }))
vi.mock('../../../../src/application/use-cases/entradas/RemoverEntrada', () => ({ RemoverEntrada: m.remover.Classe }))

const ID = '123e4567-e89b-12d3-a456-426614174000'
const ENTRADA = { id: ID, descricao: 'Salário', valor: 5000 }
const PAYLOAD = { descricao: 'Salário', valor: 5000, data: '2026-08-05', categoriaId: 'cat-1', recorrente: false }

/** O use-case precisa receber o repositório criado com o client Supabase da própria requisição. */
function esperarComposicao(Classe: typeof m.listar.Classe, req: ReturnType<typeof criarRequisicao>) {
  expect(m.Repositorio).toHaveBeenCalledWith(req.supabase)
  expect(Classe).toHaveBeenCalledWith(m.Repositorio.mock.results[0]!.value)
}

describe('entradasController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listar', () => {
    it('monta o filtro a partir da query e responde com a página', async () => {
      const pagina = { items: [ENTRADA], page: 2, pageSize: 10, total: 11, totalPages: 2 }
      m.listar.execute.mockResolvedValue(pagina)
      const req = criarRequisicao({
        query: { mes: 8, ano: 2026, categoriaId: 'cat-1', busca: 'sal', page: 2, pageSize: 10 },
      })
      const res = criarResposta()

      await entradasController.listar(req, res)

      esperarComposicao(m.listar.Classe, req)
      expect(m.listar.execute).toHaveBeenCalledWith(USUARIO.id, {
        periodo: { mes: 8, ano: 2026 },
        categoriaId: 'cat-1',
        busca: 'sal',
        page: 2,
        pageSize: 10,
      })
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(pagina)
    })

    it('propaga o erro do use-case sem responder', async () => {
      const erro = new Error('falha')
      m.listar.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(entradasController.listar(criarRequisicao({ query: { mes: 8, ano: 2026 } }), res)).rejects.toBe(erro)
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('resumo', () => {
    it('converte a competência em período e responde com o resumo', async () => {
      const resumo = { total: 5000, quantidade: 1, media: 5000, totalMesAnterior: 0, porCategoria: [] }
      m.resumo.execute.mockResolvedValue(resumo)
      const req = criarRequisicao({ query: { competencia: '2026-08' } })
      const res = criarResposta()

      await entradasController.resumo(req, res)

      esperarComposicao(m.resumo.Classe, req)
      expect(m.resumo.execute).toHaveBeenCalledWith(USUARIO.id, { mes: 8, ano: 2026 })
      expect(res.json).toHaveBeenCalledWith(resumo)
    })

    it('propaga o erro do use-case sem responder', async () => {
      const erro = new Error('falha')
      m.resumo.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(entradasController.resumo(criarRequisicao({ query: { competencia: '2026-08' } }), res)).rejects.toBe(erro)
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('criar', () => {
    it('cria com o body e responde 201 com a entrada', async () => {
      m.criar.execute.mockResolvedValue(ENTRADA)
      const req = criarRequisicao({ body: PAYLOAD })
      const res = criarResposta()

      await entradasController.criar(req, res)

      esperarComposicao(m.criar.Classe, req)
      expect(m.criar.execute).toHaveBeenCalledWith(USUARIO.id, PAYLOAD)
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(ENTRADA)
    })

    it('propaga o erro do use-case sem responder', async () => {
      const erro = new Error('falha')
      m.criar.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(entradasController.criar(criarRequisicao({ body: PAYLOAD }), res)).rejects.toBe(erro)
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('atualizar', () => {
    it('atualiza pelo id do path com o body e responde com a entrada', async () => {
      m.atualizar.execute.mockResolvedValue(ENTRADA)
      const req = criarRequisicao({ params: { id: ID }, body: PAYLOAD })
      const res = criarResposta()

      await entradasController.atualizar(req, res)

      esperarComposicao(m.atualizar.Classe, req)
      expect(m.atualizar.execute).toHaveBeenCalledWith(USUARIO.id, ID, PAYLOAD)
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(ENTRADA)
    })

    it('propaga o NotFoundError do use-case sem responder', async () => {
      const erro = new NotFoundError('Entrada')
      m.atualizar.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(entradasController.atualizar(criarRequisicao({ params: { id: ID }, body: PAYLOAD }), res)).rejects.toBe(
        erro,
      )
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('remover', () => {
    it('remove pelo id do path e responde 204 sem corpo', async () => {
      m.remover.execute.mockResolvedValue(undefined)
      const req = criarRequisicao({ params: { id: ID } })
      const res = criarResposta()

      await entradasController.remover(req, res)

      esperarComposicao(m.remover.Classe, req)
      expect(m.remover.execute).toHaveBeenCalledWith(USUARIO.id, ID)
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.send).toHaveBeenCalledWith()
    })

    it('propaga o NotFoundError do use-case sem responder', async () => {
      const erro = new NotFoundError('Entrada')
      m.remover.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(entradasController.remover(criarRequisicao({ params: { id: ID } }), res)).rejects.toBe(erro)
      expect(res.status).not.toHaveBeenCalled()
    })
  })
})
