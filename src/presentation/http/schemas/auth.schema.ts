import { z } from 'zod'

/** Limite da foto de perfil já decodificada — o frontend envia ~15–40 KB (256px JPEG). */
export const TAMANHO_MAXIMO_FOTO_BYTES = 500 * 1024

const REGEX_FOTO = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/

/** Bytes que o base64 representa (cada 4 caracteres = 3 bytes, descontando o padding). */
function bytesDoDataUrl(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

const telefoneSchema = z
  .string()
  .regex(/^\d{10,11}$/, 'Telefone inválido, informe só os números com DDD (10 ou 11 dígitos).')

export const registrarSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.'),
  nome: z.string().min(1).optional(),
  telefone: telefoneSchema.optional().nullable(),
})

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Informe o refresh token.'),
})

/**
 * PATCH /auth/me — atualização parcial: campo ausente mantém o valor atual, `null`
 * remove telefone/foto. Campos desconhecidos (ex.: um `id`) são descartados pelo Zod.
 */
export const atualizarPerfilSchema = z.object({
  nome: z
    .string({ invalid_type_error: 'O nome deve ter entre 2 e 60 caracteres.' })
    .trim()
    .min(2, 'O nome deve ter entre 2 e 60 caracteres.')
    .max(60, 'O nome deve ter entre 2 e 60 caracteres.')
    .optional(),
  email: z.string().email('E-mail inválido.').optional(),
  telefone: telefoneSchema.optional().nullable(),
  fotoUrl: z
    .string()
    .regex(REGEX_FOTO, 'Foto inválida, envie uma imagem JPEG, PNG ou WebP.')
    .refine(
      (foto) => bytesDoDataUrl(foto) <= TAMANHO_MAXIMO_FOTO_BYTES,
      `A foto deve ter no máximo ${TAMANHO_MAXIMO_FOTO_BYTES / 1024} KB.`,
    )
    .optional()
    .nullable(),
})
