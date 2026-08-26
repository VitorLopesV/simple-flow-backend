import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { ZodType } from 'zod'

type Alvo = 'body' | 'query' | 'params'

/** Valida `req[alvo]` contra um schema Zod, substituindo pelo valor já parseado/tipado. */
export function validate(schema: ZodType, alvo: Alvo = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req[alvo] = schema.parse(req[alvo])
    next()
  }
}
