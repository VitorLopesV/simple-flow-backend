import { z } from 'zod'

const tipoEntradaSchema = z.enum(['SALARIO', 'FREELANCE', 'RENDIMENTOS', 'REEMBOLSO', 'OUTROS'], {
  errorMap: () => ({ message: 'Tipo de entrada inválido, use Salário, Freelance, Rendimentos, Reembolso ou Outros.' }),
})

export const entradaPayloadSchema = z.object({
  descricao: z.string().min(1, 'Informe a descrição.'),
  valor: z.number().positive('O valor deve ser positivo.'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida, use o formato YYYY-MM-DD.'),
  categoriaId: z.string().uuid('Categoria inválida.'),
  tipo: tipoEntradaSchema,
  recorrente: z.boolean(),
  observacao: z.string().optional().nullable(),
})

export const listarEntradasQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2000),
  categoriaId: z.string().uuid().optional(),
  tipo: tipoEntradaSchema.optional(),
  busca: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
