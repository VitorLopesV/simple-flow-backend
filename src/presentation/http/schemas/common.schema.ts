import { z } from 'zod'

export const idParamSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
})

export const resumoQuerySchema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Competência inválida, use o formato YYYY-MM.'),
})

/**
 * `?confirmar=true` autoriza remover meses seguintes da série que o usuário já tinha
 * alterado (ver `SerieAlteradaError`). Ausente = false.
 */
export const confirmacaoQuerySchema = z.object({
  confirmar: z
    .enum(['true', 'false'], { message: 'Confirmação inválida, use true ou false.' })
    .optional()
    .transform((valor) => valor === 'true'),
})
