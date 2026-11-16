import { z } from 'zod'

/** Campo opcional: ausente ou null viram null, para a edição sempre substituir o valor. */
const opcional = <T extends z.ZodType>(schema: T) => schema.nullish().transform((valor) => valor ?? null)

const dataTermino = opcional(
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de término inválida, use o formato YYYY-MM-DD.')
    .refine((data) => !Number.isNaN(Date.parse(`${data}T00:00:00Z`)), 'Data de término inválida.'),
)

const camposDaSuperTask = {
  titulo: z
    .string({ message: 'Informe o título da Super task.' })
    .trim()
    .min(1, 'Informe o título da Super task.')
    .max(200, 'O título pode ter no máximo 200 caracteres.'),
  notas: opcional(z.string().max(2000, 'As notas podem ter no máximo 2000 caracteres.')),
  dataTermino,
}

/** Criação direta: título e área são obrigatórios; notas e Data de término são opcionais. */
export const superTaskPayloadSchema = z.object({
  ...camposDaSuperTask,
  areaId: z.string({ message: 'Área inválida.' }).uuid('Área inválida.'),
})

/** Edição dos campos; a área muda só por `PATCH /super-tasks/:id/area`. */
export const superTaskEdicaoSchema = z.object(camposDaSuperTask)

export const moverSuperTaskSchema = z.object({
  areaId: z.string({ message: 'Área de destino inválida.' }).uuid('Área de destino inválida.'),
})

/** Converter uma tarefa: título, área e notas vêm da tarefa; a Data de término é opcional. */
export const converterEmSuperTaskSchema = z.object({
  tarefaId: z.string({ message: 'Tarefa inválida.' }).uuid('Tarefa inválida.'),
  dataTermino,
})

export const adicionarFilhaSchema = z.object({
  tarefaId: z.string({ message: 'Tarefa inválida.' }).uuid('Tarefa inválida.'),
})

export const filhaParamsSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
  tarefaId: z.string().uuid('Tarefa inválida.'),
})

/** `?areaId=<uuid>&arquivadas=true`: arquivadas ficam ocultas a menos que `arquivadas=true`. */
export const listarSuperTasksQuerySchema = z.object({
  areaId: z.string().uuid('Área inválida.').optional(),
  arquivadas: z
    .enum(['true', 'false'], { message: 'Filtro de arquivadas inválido, use true ou false.' })
    .optional()
    .transform((valor) => valor === 'true'),
})

/** `?filhas=soltar|excluir`: o que fazer com as filhas ao excluir (sem o parâmetro, solta, que não apaga nada). */
export const removerSuperTaskQuerySchema = z.object({
  filhas: z
    .enum(['soltar', 'excluir'], { message: 'Destino das filhas inválido, use soltar ou excluir.' })
    .optional()
    .transform((valor) => (valor === 'excluir' ? ('EXCLUIR' as const) : ('SOLTAR' as const))),
})
