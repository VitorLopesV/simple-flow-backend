import { z } from 'zod'

const MENSAGEM_DIA = 'Dia inválido, use o formato YYYY-MM-DD.'
const dia = z.string({ message: MENSAGEM_DIA }).regex(/^\d{4}-\d{2}-\d{2}$/, MENSAGEM_DIA)

/** `dia` omitido usa o dia que a tarefa já tem; a regra de seg–sex e de sprint é do use-case. */
export const adicionarTarefaAoSprintSchema = z.object({
  tarefaId: z.string({ message: 'Tarefa inválida.' }).uuid('Tarefa inválida.'),
  dia: dia.optional(),
})

export const moverTarefaNoSprintSchema = z.object({ dia })
