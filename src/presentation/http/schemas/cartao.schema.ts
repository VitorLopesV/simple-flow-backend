import { z } from 'zod'

export const cartaoPayloadSchema = z.object({
  nome: z.string().min(1, 'Informe o nome do cartão.'),
  bandeira: z.enum(['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD']),
  ultimosDigitos: z.string().regex(/^\d{4}$/, 'Informe os 4 últimos dígitos.'),
  limite: z.number().min(0, 'O limite não pode ser negativo.'),
  diaFechamento: z.number().int().min(1).max(31),
  diaVencimento: z.number().int().min(1).max(28),
  cor: z.string().min(1),
  ativo: z.boolean(),
})

export const faturaFiltroQuerySchema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Competência inválida, use o formato YYYY-MM.'),
  cartaoId: z.string().uuid().optional(),
})

/**
 * Débito lançado no cartão — mesmos campos de uma saída, sem forma de pagamento
 * (é sempre o cartão) e sem situação (quem é paga é a fatura).
 */
export const transacaoCartaoPayloadSchema = z.object({
  descricao: z.string().min(1, 'Informe a descrição.'),
  valor: z.number().positive('O valor deve ser positivo.'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida, use o formato YYYY-MM-DD.'),
  categoriaId: z.string().uuid('Categoria inválida.'),
  tipo: z.enum(['TRANSPORTE', 'ALIMENTACAO', 'LAZER', 'CONTA', 'POUPANCA', 'ACOES', 'OUTROS']),
  parcelaAtual: z.number().int().min(1).default(1),
  totalParcelas: z.number().int().min(1).default(1),
  recorrente: z.boolean(),
  observacao: z.string().optional().nullable(),
})

export const cartaoIdParamSchema = z.object({
  cartaoId: z.string().uuid('Cartão inválido.'),
})

export const transacaoCartaoParamsSchema = z.object({
  cartaoId: z.string().uuid('Cartão inválido.'),
  id: z.string().uuid('Identificador inválido.'),
})
