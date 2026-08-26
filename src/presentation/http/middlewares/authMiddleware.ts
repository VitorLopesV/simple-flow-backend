import type { NextFunction, Request, Response } from 'express'

import { UnauthorizedError } from '../../../domain/errors/DomainError'
import { SupabaseAuthService } from '../../../infrastructure/auth/SupabaseAuthService'
import { supabaseClientForRequest } from '../../../infrastructure/supabase/supabaseClientForRequest'

/**
 * Extrai o Bearer token, valida junto ao Supabase Auth e popula `req.usuario` +
 * `req.supabase` (client escopado no JWT do usuário, para que o RLS aplique o
 * isolamento multi-tenant). Deve rodar antes de qualquer rota que acesse dados.
 */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const cabecalho = req.headers.authorization
  const token = cabecalho?.startsWith('Bearer ') ? cabecalho.slice('Bearer '.length) : null

  if (!token) {
    next(new UnauthorizedError('Token de acesso ausente.'))
    return
  }

  try {
    const usuario = await SupabaseAuthService.obterUsuarioPorToken(token)
    req.usuario = { id: usuario.id, email: usuario.email, nome: usuario.nome }
    req.supabase = supabaseClientForRequest(token)
    next()
  } catch (erro) {
    next(erro)
  }
}
