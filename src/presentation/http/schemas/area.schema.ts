import { z } from 'zod'

export const areaPayloadSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da área.').max(60, 'O nome pode ter no máximo 60 caracteres.'),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida, use o formato #RRGGBB.'),
})

/**
 * Exclusão de área: `?tarefas=mover&destinoId=<uuid>` ou `?tarefas=excluir`. Ambos
 * opcionais — sem eles, a exclusão só passa se a área não tiver tarefas.
 */
export const removerAreaQuerySchema = z
  .object({
    tarefas: z.enum(['mover', 'excluir'], { message: 'Escolha mover ou excluir as tarefas.' }).optional(),
    destinoId: z.string().uuid('Área de destino inválida.').optional(),
  })
  .refine((q) => q.tarefas !== 'mover' || q.destinoId !== undefined, {
    message: 'Informe a área de destino das tarefas.',
    path: ['destinoId'],
  })
  .refine((q) => q.tarefas === 'mover' || q.destinoId === undefined, {
    message: 'A área de destino só vale ao mover as tarefas.',
    path: ['destinoId'],
  })
