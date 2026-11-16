import { z } from 'zod'

const DATA = /^\d{4}-\d{2}-\d{2}$/
const MENSAGEM_DIA = 'Dia da semana inválido: use de 1 (segunda) a 5 (sexta).'

const diaUtil = z.number({ message: MENSAGEM_DIA }).int(MENSAGEM_DIA).min(1, MENSAGEM_DIA).max(5, MENSAGEM_DIA)

const repeticaoSchema = z.discriminatedUnion(
  'modo',
  [
    z.object({
      modo: z.literal('DIAS_DA_SEMANA'),
      dias: z
        .array(diaUtil, { message: 'Marque pelo menos um dia da semana.' })
        .min(1, 'Marque pelo menos um dia da semana.')
        // Sem repetidos e em ordem: a regra é um conjunto.
        .transform((dias) => [...new Set(dias)].sort((a, b) => a - b) as (1 | 2 | 3 | 4 | 5)[]),
    }),
    z.object({
      modo: z.literal('A_CADA_N_DIAS'),
      intervalo: z
        .number({ message: 'Informe o intervalo em dias (mínimo 1).' })
        .int('Informe o intervalo em dias (mínimo 1).')
        .min(1, 'Informe o intervalo em dias (mínimo 1).')
        .max(365, 'O intervalo pode ter no máximo 365 dias.'),
      dataInicial: z
        .string({ message: 'Informe a data inicial.' })
        .regex(DATA, 'Data inicial inválida, use o formato YYYY-MM-DD.')
        // Rejeita datas que a regex aceita mas não existem (2026-02-31).
        .refine((data) => {
          const convertida = new Date(`${data}T00:00:00Z`)
          return !Number.isNaN(convertida.getTime()) && convertida.toISOString().slice(0, 10) === data
        }, {
          message: 'Data inicial inválida, use o formato YYYY-MM-DD.',
        }),
    }),
  ],
  { errorMap: () => ({ message: 'Informe a repetição: DIAS_DA_SEMANA ou A_CADA_N_DIAS.' }) },
)

const vezSchema = z.object({
  hora: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida, use o formato HH:MM.')
    .nullish()
    .transform((hora) => hora ?? null),
})

/** Criação e edição (PUT substitui o item inteiro). */
export const rotinaPayloadSchema = z.object({
  nome: z
    .string({ message: 'Informe o nome do item.' })
    .trim()
    .min(1, 'Informe o nome do item.')
    .max(120, 'O nome pode ter no máximo 120 caracteres.'),
  repeticao: repeticaoSchema,
  vezes: z
    .array(vezSchema, { message: 'Informe pelo menos uma vez no dia.' })
    .min(1, 'Informe pelo menos uma vez no dia.')
    .max(12, 'No máximo 12 vezes por dia.')
    .refine((vezes) => new Set(vezes.map((v) => v.hora)).size === vezes.length, {
      message: 'Há vezes repetidas no dia.',
    }),
})
