import { timingSafeEqual } from 'node:crypto'

import type { NextFunction, Request, Response } from 'express'

import { UnauthorizedError } from '../../../domain/errors/DomainError'
import { env } from '../../../infrastructure/config/env'

/**
 * Protege rotas chamadas só pelo Vercel Cron, que envia `Authorization: Bearer <CRON_SECRET>`.
 * Sem `CRON_SECRET` configurada nada passa (falha fechada), em vez de deixar a rota pública.
 */
export function cronMiddleware(req: Request, _res: Response, next: NextFunction) {
  const esperado = env.cronSecret
  const recebido = req.headers.authorization

  if (!esperado || !recebido) {
    next(new UnauthorizedError('Chamada não autorizada.'))
    return
  }

  const a = Buffer.from(recebido)
  const b = Buffer.from(`Bearer ${esperado}`)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    next(new UnauthorizedError('Chamada não autorizada.'))
    return
  }

  next()
}
