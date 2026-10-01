import { z } from 'zod'

export const idParamSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
})

export const resumoQuerySchema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Competência inválida, use o formato YYYY-MM.'),
})
