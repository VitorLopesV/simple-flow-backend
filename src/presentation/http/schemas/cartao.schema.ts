import { z } from 'zod'

export const cartaoPayloadSchema = z.object({
  nome: z.string().min(1, 'Informe o nome do cartão.'),
  bandeira: z.enum(['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD']),
  ultimosDigitos: z.string().regex(/^\d{4}$/, 'Informe os 4 últimos dígitos.'),
  limite: z.number().min(0, 'O limite não pode ser negativo.'),
  diaFechamento: z.number().int().min(1).max(28),
  diaVencimento: z.number().int().min(1).max(28),
  cor: z.string().min(1),
  ativo: z.boolean(),
})

export const faturaFiltroQuerySchema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Competência inválida, use o formato YYYY-MM.'),
  cartaoId: z.string().uuid().optional(),
})
