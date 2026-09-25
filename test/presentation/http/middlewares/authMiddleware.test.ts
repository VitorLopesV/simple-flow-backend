import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UnauthorizedError } from '../../../../src/domain/errors/DomainError'
import { authMiddleware } from '../../../../src/presentation/http/middlewares/authMiddleware'

const { obterUsuarioPorToken, supabaseClientForRequest } = vi.hoisted(() => ({
  obterUsuarioPorToken: vi.fn(),
  supabaseClientForRequest: vi.fn(),
}))

vi.mock('../../../../src/infrastructure/auth/SupabaseAuthService', () => ({
  SupabaseAuthService: { obterUsuarioPorToken },
}))

vi.mock('../../../../src/infrastructure/supabase/supabaseClientForRequest', () => ({
  supabaseClientForRequest,
}))

const res = {} as Response
const clienteFake = { fake: 'supabase-client' }

function criarRequisicao(authorization?: string) {
  return { headers: authorization === undefined ? {} : { authorization } } as unknown as Request
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    obterUsuarioPorToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', nome: 'Ana' })
    supabaseClientForRequest.mockReturnValue(clienteFake)
  })

  it('chama next com UnauthorizedError sem consultar o serviço quando falta o header Authorization', async () => {
    const next = vi.fn()

    await authMiddleware(criarRequisicao(), res, next)

    const erro = next.mock.calls[0]![0]
    expect(erro).toBeInstanceOf(UnauthorizedError)
    expect(erro.message).toBe('Token de acesso ausente.')
    expect(obterUsuarioPorToken).not.toHaveBeenCalled()
  })

  it('chama next com UnauthorizedError para o header Basic abc', async () => {
    const next = vi.fn()

    await authMiddleware(criarRequisicao('Basic abc'), res, next)

    expect(next.mock.calls[0]![0]).toBeInstanceOf(UnauthorizedError)
  })

  it('chama next com UnauthorizedError para Bearer com token vazio', async () => {
    const next = vi.fn()

    await authMiddleware(criarRequisicao('Bearer '), res, next)

    expect(next.mock.calls[0]![0]).toBeInstanceOf(UnauthorizedError)
  })

  it('chama next com UnauthorizedError para bearer em minúsculo (comparação case-sensitive)', async () => {
    const next = vi.fn()

    await authMiddleware(criarRequisicao('bearer abc'), res, next)

    expect(next.mock.calls[0]![0]).toBeInstanceOf(UnauthorizedError)
  })

  it('popula req.usuario e req.supabase e chama next sem argumentos com token válido', async () => {
    const req = criarRequisicao('Bearer abc')
    const next = vi.fn()

    await authMiddleware(req, res, next)

    expect(obterUsuarioPorToken).toHaveBeenCalledWith('abc')
    expect(supabaseClientForRequest).toHaveBeenCalledWith('abc')
    expect(req.usuario).toEqual({ id: 'user-1', email: 'a@b.com', nome: 'Ana' })
    expect(req.supabase).toBe(clienteFake)
    expect(next).toHaveBeenCalledWith()
  })

  it('mantém em req.usuario apenas id, email e nome quando o usuário retornado tem campos extras', async () => {
    obterUsuarioPorToken.mockResolvedValue({ id: 'user-1', email: 'a@b.com', nome: 'Ana', senhaHash: 'x', papel: 'admin' })
    const req = criarRequisicao('Bearer abc')

    await authMiddleware(req, res, vi.fn())

    expect(req.usuario).toEqual({ id: 'user-1', email: 'a@b.com', nome: 'Ana' })
  })

  it('repassa o erro do serviço a next sem definir req.usuario nem req.supabase', async () => {
    const erro = new UnauthorizedError('Token inválido.')
    obterUsuarioPorToken.mockRejectedValue(erro)
    const req = criarRequisicao('Bearer abc')
    const next = vi.fn()

    await authMiddleware(req, res, next)

    expect(next).toHaveBeenCalledWith(erro)
    expect(req.usuario).toBeUndefined()
    expect(req.supabase).toBeUndefined()
  })

  it('chama next exatamente uma vez em qualquer cenário', async () => {
    const cenarios: (string | undefined)[] = [undefined, 'Basic abc', 'Bearer ', 'bearer abc', 'Bearer abc']

    for (const cabecalho of cenarios) {
      const next = vi.fn()
      await authMiddleware(criarRequisicao(cabecalho), res, next)
      expect(next).toHaveBeenCalledTimes(1)
    }

    obterUsuarioPorToken.mockRejectedValue(new UnauthorizedError('Token inválido.'))
    const next = vi.fn()
    await authMiddleware(criarRequisicao('Bearer abc'), res, next)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
