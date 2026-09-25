import type { Request, Response } from 'express'
import { vi } from 'vitest'

export const USUARIO = { id: 'user-1', email: 'ana@exemplo.com', nome: 'Ana' }

/** Requisição já autenticada, como os controllers a recebem depois do authMiddleware e do validate. */
export function criarRequisicao({ body = {}, query = {}, params = {} }: { body?: unknown; query?: unknown; params?: unknown } = {}) {
  return {
    body,
    query,
    params,
    usuario: USUARIO,
    supabase: { cliente: 'supabase-da-requisicao' },
  } as unknown as Request
}

/** Resposta do Express com `status`/`json`/`send` espionados e encadeáveis. */
export function criarResposta() {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() }
  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  res.send.mockReturnValue(res)
  return res as typeof res & Response
}
