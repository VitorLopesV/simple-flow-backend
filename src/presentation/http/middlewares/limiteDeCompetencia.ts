import type { Request, RequestHandler } from 'express'

import { ValidarCompetencia } from '../../../application/use-cases/navegacao/ValidarCompetencia'
import { SupabaseNavegacaoRepository } from '../../../infrastructure/supabase/repositories/SupabaseNavegacaoRepository'
import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { paraCompetencia } from '../../../shared/utils/periodo'

/** Competência (`YYYY-MM`) que a rota consulta, lida da query já validada pelo schema. */
type ExtrairCompetencia = (req: Request) => string

/** Query `?competencia=YYYY-MM` (resumos, faturas, dashboard). */
export const daCompetencia: ExtrairCompetencia = (req) => (req.query as { competencia: string }).competencia

/** Query `?mes=&ano=` (listagens de entradas e saídas). */
export const doMesEAno: ExtrairCompetencia = (req) => {
  const { mes, ano } = req.query as unknown as { mes: number; ano: number }
  return paraCompetencia({ mes, ano })
}

/**
 * Rejeita (422) competência fora dos limites de navegação do usuário (ver
 * `ObterLimitesNavegacao`). Vem depois do `authMiddleware` e do `validate` da query.
 */
export function limiteDeCompetencia(extrair: ExtrairCompetencia): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const validar = new ValidarCompetencia(new SupabaseNavegacaoRepository(req.supabase!))
    await validar.execute(req.usuario!.id, extrair(req))
    next()
  })
}
