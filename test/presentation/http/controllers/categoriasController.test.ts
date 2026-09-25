import { beforeEach, describe, expect, it, vi } from 'vitest'

import { categoriasController } from '../../../../src/presentation/http/controllers/categoriasController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => {
  const execute = vi.fn()
  return {
    Repositorio: vi.fn(function (client: unknown) { return { repositorio: 'categorias', client } }),
    execute,
    ListarCategorias: vi.fn(function () { return { execute } }),
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseCategoriaRepository', () => ({
  SupabaseCategoriaRepository: m.Repositorio,
}))
vi.mock('../../../../src/application/use-cases/categorias/ListarCategorias', () => ({
  ListarCategorias: m.ListarCategorias,
}))

describe('categoriasController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listar: compõe repositório e use-case com o client da requisição e responde com as categorias', async () => {
    const categorias = [{ id: 'cat-1', nome: 'Alimentação' }]
    m.execute.mockResolvedValue(categorias)
    const req = criarRequisicao()
    const res = criarResposta()

    await categoriasController.listar(req, res)

    expect(m.Repositorio).toHaveBeenCalledWith(req.supabase)
    expect(m.ListarCategorias).toHaveBeenCalledWith(m.Repositorio.mock.results[0]!.value)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id)
    expect(res.json).toHaveBeenCalledWith(categorias)
  })

  it('listar: propaga o erro do use-case sem responder', async () => {
    const erro = new Error('falha')
    m.execute.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(categoriasController.listar(criarRequisicao(), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })
})
