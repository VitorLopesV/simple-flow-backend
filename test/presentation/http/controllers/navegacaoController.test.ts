import { beforeEach, describe, expect, it, vi } from 'vitest'

import { navegacaoController } from '../../../../src/presentation/http/controllers/navegacaoController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => {
  const execute = vi.fn()
  return {
    Repositorio: vi.fn(function (client: unknown) { return { repositorio: 'navegacao', client } }),
    execute,
    ObterLimitesNavegacao: vi.fn(function () { return { execute } }),
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseNavegacaoRepository', () => ({
  SupabaseNavegacaoRepository: m.Repositorio,
}))
vi.mock('../../../../src/application/use-cases/navegacao/ObterLimitesNavegacao', () => ({
  ObterLimitesNavegacao: m.ObterLimitesNavegacao,
}))

describe('navegacaoController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('limites: compõe o use-case com o repositório da requisição e responde com os limites', async () => {
    const limites = { primeiroMes: '2026-01', ultimoMes: '2026-11' }
    m.execute.mockResolvedValue(limites)
    const req = criarRequisicao()
    const res = criarResposta()

    await navegacaoController.limites(req, res)

    expect(m.Repositorio).toHaveBeenCalledWith(req.supabase)
    expect(m.ObterLimitesNavegacao).toHaveBeenCalledWith(m.Repositorio.mock.results[0]!.value)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id)
    expect(res.json).toHaveBeenCalledWith(limites)
  })

  it('propaga o erro do use-case sem responder', async () => {
    const erro = new Error('falha')
    m.execute.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(navegacaoController.limites(criarRequisicao(), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })
})
