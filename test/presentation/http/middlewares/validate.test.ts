import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { z, ZodError } from 'zod'

import { validate } from '../../../../src/presentation/http/middlewares/validate'

const res = {} as Response

function criarRequisicao(partes: { body?: unknown; query?: unknown; params?: unknown } = {}) {
  return { body: {}, query: {}, params: {}, ...partes } as unknown as Request
}

describe('validate', () => {
  it('substitui req.body pelo valor parseado e chama next sem argumentos quando o alvo é omitido', () => {
    const req = criarRequisicao({ body: { nome: 'Ana' } })
    const next = vi.fn()

    validate(z.object({ nome: z.string() }))(req, res, next)

    expect(req.body).toEqual({ nome: 'Ana' })
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
  })

  it('aplica coerção e defaults do schema em query', () => {
    const req = criarRequisicao({ query: { mes: '9' } })
    const schema = z.object({ mes: z.coerce.number(), page: z.coerce.number().default(1) })

    validate(schema, 'query')(req, res, vi.fn())

    expect(req.query).toEqual({ mes: 9, page: 1 })
  })

  it('substitui req.params pelo valor parseado quando o alvo é params', () => {
    const req = criarRequisicao({ params: { id: '42' } })

    validate(z.object({ id: z.coerce.number() }), 'params')(req, res, vi.fn())

    expect(req.params).toEqual({ id: 42 })
  })

  it('remove campos extras do body', () => {
    const req = criarRequisicao({ body: { nome: 'Ana', extra: 'x' } })

    validate(z.object({ nome: z.string() }))(req, res, vi.fn())

    expect(req.body).toEqual({ nome: 'Ana' })
  })

  it('lança ZodError sem chamar next e sem alterar req.body quando o body é inválido', () => {
    const corpo = { nome: 123 }
    const req = criarRequisicao({ body: corpo })
    const next = vi.fn()

    expect(() => validate(z.object({ nome: z.string() }))(req, res, next)).toThrow(ZodError)

    expect(next).not.toHaveBeenCalled()
    expect(req.body).toBe(corpo)
  })

  it('não altera os outros alvos de req ao validar um alvo', () => {
    const query = { mes: '9' }
    const params = { id: '42' }
    const req = criarRequisicao({ body: { nome: 'Ana', extra: 'x' }, query, params })

    validate(z.object({ nome: z.string() }))(req, res, vi.fn())

    expect(req.query).toBe(query)
    expect(req.params).toBe(params)
  })
})
