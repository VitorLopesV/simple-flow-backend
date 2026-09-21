import type { NextFunction, Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z, ZodError } from 'zod'

import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../../src/domain/errors/DomainError'
import { errorHandler } from '../../../../src/presentation/http/middlewares/errorHandler'

function criarContexto() {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))

  return {
    req: {} as Request,
    res: { status } as unknown as Response,
    next: vi.fn() as unknown as NextFunction,
    status,
    json,
  }
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('responde 404 com a mensagem de NotFoundError', () => {
    const { req, res, next, status, json } = criarContexto()

    errorHandler(new NotFoundError('Saída'), req, res, next)

    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({ message: 'Saída não encontrado.' })
  })

  it('responde 422 com a mensagem padrão de ValidationError sem mensagem', () => {
    const { req, res, next, status, json } = criarContexto()

    errorHandler(new ValidationError(), req, res, next)

    expect(status).toHaveBeenCalledWith(422)
    expect(json).toHaveBeenCalledWith({ message: 'Dados inválidos.' })
  })

  it('responde 401 para UnauthorizedError', () => {
    const { req, res, next, status } = criarContexto()

    errorHandler(new UnauthorizedError(), req, res, next)

    expect(status).toHaveBeenCalledWith(401)
  })

  it('responde 409 para ConflictError', () => {
    const { req, res, next, status } = criarContexto()

    errorHandler(new ConflictError(), req, res, next)

    expect(status).toHaveBeenCalledWith(409)
  })

  it('responde 422 com a mensagem do primeiro issue de um ZodError real', () => {
    const { req, res, next, status, json } = criarContexto()
    const resultado = z.object({ nome: z.string().min(1, 'Informe o nome.') }).safeParse({ nome: '' })
    if (resultado.success) throw new Error('o schema deveria rejeitar o valor')

    errorHandler(resultado.error, req, res, next)

    expect(status).toHaveBeenCalledWith(422)
    expect(json).toHaveBeenCalledWith({ message: 'Informe o nome.' })
  })

  it('responde 422 com mensagem padrão para ZodError sem issues', () => {
    const { req, res, next, status, json } = criarContexto()

    errorHandler(new ZodError([]), req, res, next)

    expect(status).toHaveBeenCalledWith(422)
    expect(json).toHaveBeenCalledWith({ message: 'Dados inválidos.' })
  })

  it('responde 500 genérico para Error comum sem vazar mensagem nem stack', () => {
    const { req, res, next, status, json } = criarContexto()
    const erro = new Error('senha do banco: hunter2')

    errorHandler(erro, req, res, next)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({ message: 'Erro interno do servidor.' })
    const corpo = JSON.stringify(json.mock.calls[0]![0])
    expect(corpo).not.toContain('hunter2')
    expect(corpo).not.toContain(erro.stack!)
  })

  it('registra o erro original com console.error', () => {
    const { req, res, next } = criarContexto()
    const erro = new Error('falhou')

    errorHandler(erro, req, res, next)

    expect(console.error).toHaveBeenCalledWith(erro)
  })

  it('responde 500 genérico quando o valor lançado não é um Error', () => {
    const { req, res, next, status, json } = criarContexto()

    errorHandler('falhou', req, res, next)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({ message: 'Erro interno do servidor.' })
  })

  it('não chama console.error para DomainError', () => {
    const { req, res, next } = criarContexto()

    errorHandler(new NotFoundError('Saída'), req, res, next)

    expect(console.error).not.toHaveBeenCalled()
  })

  it('nunca chama next', () => {
    const erros = [new NotFoundError('Saída'), new ZodError([]), new Error('falhou'), 'falhou']

    for (const erro of erros) {
      const { req, res, next } = criarContexto()

      errorHandler(erro, req, res, next)

      expect(next).not.toHaveBeenCalled()
    }
  })
})
