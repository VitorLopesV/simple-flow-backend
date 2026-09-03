import { z } from 'zod'

export const saidaPayloadSchema = z.object({
  descricao: z.string().min(1, 'Informe a descrição.'),
  valor: z.number().positive('O valor deve ser positivo.'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida, use o formato YYYY-MM-DD.'),
  categoriaId: z.string().uuid('Categoria inválida.'),
  tipo: z.enum(['TRANSPORTE', 'ALIMENTACAO', 'LAZER', 'CONTA', 'POUPANCA', 'ACOES', 'OUTROS']),
  status: z.enum(['PAGO', 'PENDENTE']),
  // Sem CARTAO_CREDITO de propósito: gasto no cartão é lançado no próprio cartão
  // (POST /cartoes/:cartaoId/transacoes) e chega aqui como a fatura, saída derivada.
  formaPagamento: z.enum(['DINHEIRO', 'PIX', 'DEBITO', 'BOLETO'], {
    message: 'Gastos no cartão de crédito devem ser lançados na aba Cartões.',
  }),
  recorrente: z.boolean(),
  observacao: z.string().optional().nullable(),
})

export const listarSaidasQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2000),
  categoriaId: z.string().uuid().optional(),
  status: z.enum(['PAGO', 'PENDENTE']).optional(),
  busca: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
