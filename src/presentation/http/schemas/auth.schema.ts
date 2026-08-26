import { z } from 'zod'

export const registrarSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.'),
  nome: z.string().min(1).optional(),
})

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Informe o refresh token.'),
})
