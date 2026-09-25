import { z } from 'zod'

export const idParamSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
})

/**
 * Aceita tanto um id real (UUID) quanto o id sintético de uma ocorrência
 * projetada de recorrência (`${uuid}_${competencia}`, ver `projetarRecorrencias`
 * em shared/utils/recorrencia.ts) — usado nas rotas de atualização, que
 * materializam a ocorrência projetada em uma linha própria ao editá-la.
 */
export const idOuProjetadoParamSchema = z.object({
  id: z.string().regex(/^[0-9a-f-]{36}(_\d{4}-\d{2})?$/i, 'Identificador inválido.'),
})

export const resumoQuerySchema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Competência inválida, use o formato YYYY-MM.'),
})
