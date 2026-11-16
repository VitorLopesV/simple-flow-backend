import { z } from 'zod'

/** Campo opcional: ausente ou null viram null, para a edição sempre substituir o valor. */
const opcional = <T extends z.ZodType>(schema: T) => schema.nullish().transform((valor) => valor ?? null)

const TEMPOS: number[] = [15, 30, 60, 120, 240]
const MENSAGEM_TEMPO = 'Tempo estimado inválido: use 15, 30, 60, 120 ou 240 minutos.'

const camposDaTarefa = {
  titulo: z
    .string({ message: 'Informe o título da tarefa.' })
    .trim()
    .min(1, 'Informe o título da tarefa.')
    .max(200, 'O título pode ter no máximo 200 caracteres.'),
  dia: opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dia inválido, use o formato YYYY-MM-DD.')),
  hora: opcional(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida, use o formato HH:MM.')),
  tempoEstimado: opcional(
    z
      .number({ message: MENSAGEM_TEMPO })
      .refine((minutos): minutos is 15 | 30 | 60 | 120 | 240 => TEMPOS.includes(minutos), { message: MENSAGEM_TEMPO }),
  ),
  dificuldade: opcional(z.enum(['FACIL', 'MEDIA', 'DIFICIL'], { message: 'Dificuldade inválida.' })),
  prioridade: opcional(z.enum(['BAIXA', 'MEDIA', 'ALTA'], { message: 'Prioridade inválida.' })),
  notas: opcional(z.string().max(2000, 'As notas podem ter no máximo 2000 caracteres.')),
}

/** Criação: só o título e a área são obrigatórios, para anotar rápido. */
export const tarefaPayloadSchema = z.object({
  ...camposDaTarefa,
  areaId: z.string({ message: 'Área inválida.' }).uuid('Área inválida.'),
})

/** Edição dos campos; a área muda só por `PATCH /tarefas/:id/area`. */
export const tarefaEdicaoSchema = z.object(camposDaTarefa)

export const moverTarefaSchema = z.object({
  areaId: z.string({ message: 'Área de destino inválida.' }).uuid('Área de destino inválida.'),
})

/** `?areaId=<uuid>&arquivadas=true`: arquivadas ficam ocultas a menos que `arquivadas=true`. */
export const listarTarefasQuerySchema = z.object({
  areaId: z.string().uuid('Área inválida.').optional(),
  arquivadas: z
    .enum(['true', 'false'], { message: 'Filtro de arquivadas inválido, use true ou false.' })
    .optional()
    .transform((valor) => valor === 'true'),
})
