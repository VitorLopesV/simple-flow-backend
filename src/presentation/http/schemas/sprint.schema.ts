import { z } from 'zod'

const MENSAGEM_DIA = 'Dia inválido, use o formato YYYY-MM-DD.'
const dia = z.string({ message: MENSAGEM_DIA }).regex(/^\d{4}-\d{2}-\d{2}$/, MENSAGEM_DIA)

/** `dia` omitido usa o dia que a tarefa já tem; a regra de seg–sex e de sprint é do use-case. */
export const adicionarTarefaAoSprintSchema = z.object({
  tarefaId: z.string({ message: 'Tarefa inválida.' }).uuid('Tarefa inválida.'),
  dia: dia.optional(),
})

export const moverTarefaNoSprintSchema = z.object({ dia })

export const LIMITE_RECOMPENSA = 120
export const LIMITE_MAXIMO_DO_HISTORICO = 50

const MENSAGEM_RECOMPENSA = `Recompensa inválida: use um texto de até ${LIMITE_RECOMPENSA} caracteres.`

/** Texto aparado; vazio vira `null` (limpa a recompensa). */
const recompensa = z
  .string({ message: MENSAGEM_RECOMPENSA })
  .max(LIMITE_RECOMPENSA * 4, MENSAGEM_RECOMPENSA)
  .nullable()
  .transform((texto) => (texto === null || texto.trim() === '' ? null : texto.trim()))
  .refine((texto) => texto === null || texto.length <= LIMITE_RECOMPENSA, MENSAGEM_RECOMPENSA)

export const recompensaDoSprintSchema = z.object({ recompensa })

export const recompensaPadraoSchema = z.object({ recompensaPadrao: recompensa })

export const historicoQuerySchema = z.object({
  page: z.coerce.number({ message: 'Página inválida.' }).int('Página inválida.').min(1, 'Página inválida.').default(1),
  pageSize: z.coerce
    .number({ message: 'Tamanho de página inválido.' })
    .int('Tamanho de página inválido.')
    .min(1, 'Tamanho de página inválido.')
    .max(LIMITE_MAXIMO_DO_HISTORICO, `Tamanho de página inválido: no máximo ${LIMITE_MAXIMO_DO_HISTORICO}.`)
    .default(10),
})
