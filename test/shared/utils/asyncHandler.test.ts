import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../../../src/domain/errors/DomainError'
import { asyncHandler } from '../../../src/shared/utils/asyncHandler'

function criarContexto() {
  return {
    req: {} as Request,
    res: {} as Response,
    next: vi.fn(),
  }
}

describe('asyncHandler', () => {
  it('chama o handler com req, res e next sem acionar next quando resolve', async () => {
    const { req, res, next } = criarContexto()
    const handler = vi.fn().mockResolvedValue(undefined)

    asyncHandler(handler)(req, res, next)
    await Promise.resolve()

    expect(handler).toHaveBeenCalledWith(req, res, next)
    expect(next).not.toHaveBeenCalled()
  })

  it('repassa para next o Error rejeitado pelo handler', async () => {
    const { req, res, next } = criarContexto()
    const erro = new Error('falhou')

    asyncHandler(() => Promise.reject(erro))(req, res, next)
    await Promise.resolve()

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(erro)
  })

  it('repassa para next a mesma instância de DomainError rejeitada', async () => {
    const { req, res, next } = criarContexto()
    const erro = new NotFoundError('Entrada')

    asyncHandler(() => Promise.reject(erro))(req, res, next)
    await Promise.resolve()

    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0]![0]).toBe(erro)
  })

  it('retorna uma função síncrona que devolve undefined, sem expor a promise', () => {
    const { req, res, next } = criarContexto()
    const wrapper = asyncHandler(() => Promise.resolve())

    expect(typeof wrapper).toBe('function')
    expect(wrapper(req, res, next)).toBeUndefined()
  })
})
