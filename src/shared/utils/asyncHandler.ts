import type { NextFunction, Request, RequestHandler, Response } from 'express'

/** Express 4 não repassa rejeições de handlers async para o errorHandler automaticamente. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next)
  }
}
