import type { Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UnauthorizedError } from '../../../../src/domain/errors/DomainError'
import { cronMiddleware } from '../../../../src/presentation/http/middlewares/cronMiddleware'

const { env } = vi.hoisted(() => ({ env: { cronSecret: 'segredo-do-cron' as string | undefined } }))

vi.mock('../../../../src/infrastructure/config/env', () => ({ env }))

const res = {} as Response

function criarRequisicao(authorization?: string) {
  return { headers: authorization === undefined ? {} : { authorization } } as unknown as Request
}

describe('cronMiddleware', () => {
  beforeEach(() => {
    env.cronSecret = 'segredo-do-cron'
  })

  it('chama next sem argumentos com o Bearer igual à CRON_SECRET', () => {
    const next = vi.fn()

    cronMiddleware(criarRequisicao('Bearer segredo-do-cron'), res, next)

    expect(next).toHaveBeenCalledWith()
  })

  it.each([
    ['sem header Authorization', undefined],
    ['com segredo errado', 'Bearer outro-segredo-'],
    ['com segredo de outro tamanho', 'Bearer x'],
    ['sem o prefixo Bearer', 'segredo-do-cron'],
  ])('chama next com UnauthorizedError %s', (_descricao, authorization) => {
    const next = vi.fn()

    cronMiddleware(criarRequisicao(authorization), res, next)

    const erro = next.mock.calls[0]![0]
    expect(erro).toBeInstanceOf(UnauthorizedError)
    expect(erro.message).toBe('Chamada não autorizada.')
  })

  it('falha fechada quando CRON_SECRET não está configurada, mesmo com "Bearer undefined"', () => {
    env.cronSecret = undefined
    const next = vi.fn()

    cronMiddleware(criarRequisicao('Bearer undefined'), res, next)

    expect(next.mock.calls[0]![0]).toBeInstanceOf(UnauthorizedError)
  })
})
