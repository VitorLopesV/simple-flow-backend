import type { NextFunction, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ValidationError } from '../../../../src/domain/errors/DomainError'
import {
  daCompetencia,
  doMesEAno,
  limiteDeCompetencia,
} from '../../../../src/presentation/http/middlewares/limiteDeCompetencia'
import { USUARIO, criarRequisicao } from '../../../helpers/http'

const m = vi.hoisted(() => {
  const execute = vi.fn()
  return {
    Repositorio: vi.fn(function (client: unknown) { return { repositorio: 'navegacao', client } }),
    execute,
    ValidarCompetencia: vi.fn(function () { return { execute } }),
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseNavegacaoRepository', () => ({
  SupabaseNavegacaoRepository: m.Repositorio,
}))
vi.mock('../../../../src/application/use-cases/navegacao/ValidarCompetencia', () => ({
  ValidarCompetencia: m.ValidarCompetencia,
}))

/** O middleware é envolto em asyncHandler: espera o `next` ser chamado (com ou sem erro). */
async function executar(handler: ReturnType<typeof limiteDeCompetencia>, req: ReturnType<typeof criarRequisicao>) {
  return new Promise<unknown>((resolve) => {
    const next = vi.fn((erro?: unknown) => resolve(erro)) as unknown as NextFunction
    handler(req, {} as Response, next)
  })
}

describe('limiteDeCompetencia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('valida a competência da query com o repositório da requisição e segue', async () => {
    m.execute.mockResolvedValue(undefined)
    const req = criarRequisicao({ query: { competencia: '2026-08' } })

    const erro = await executar(limiteDeCompetencia(daCompetencia), req)

    expect(erro).toBeUndefined()
    expect(m.Repositorio).toHaveBeenCalledWith(req.supabase)
    expect(m.ValidarCompetencia).toHaveBeenCalledWith(m.Repositorio.mock.results[0]!.value)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, '2026-08')
  })

  it('monta a competência a partir de mes e ano', async () => {
    m.execute.mockResolvedValue(undefined)

    await executar(limiteDeCompetencia(doMesEAno), criarRequisicao({ query: { mes: 3, ano: 2026 } }))

    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, '2026-03')
  })

  it('repassa o ValidationError ao errorHandler', async () => {
    const falha = new ValidationError('Competência fora do intervalo permitido (2026-01 a 2026-11).')
    m.execute.mockRejectedValue(falha)

    const erro = await executar(limiteDeCompetencia(daCompetencia), criarRequisicao({ query: { competencia: '2025-12' } }))

    expect(erro).toBe(falha)
  })
})
