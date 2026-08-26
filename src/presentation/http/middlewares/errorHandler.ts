import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

import { DomainError } from '../../../domain/errors/DomainError'

/**
 * Middleware de erro do Express — mapeia DomainError (e subclasses) e ZodError para
 * o status HTTP correspondente, no formato `{ message }` que frontend/src/services/http.ts
 * já espera. Erros não reconhecidos viram 500 genérico (nunca vaza stack trace).
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof DomainError) {
    res.status(error.status).json({ message: error.message })
    return
  }

  if (error instanceof ZodError) {
    const primeiro = error.issues[0]
    res.status(422).json({ message: primeiro?.message ?? 'Dados inválidos.' })
    return
  }

  console.error(error)
  res.status(500).json({ message: 'Erro interno do servidor.' })
}
