import type { SafeParseReturnType } from 'zod'
import { describe, expect, it } from 'vitest'

import { loginSchema, refreshSchema, registrarSchema } from '../../../../src/presentation/http/schemas/auth.schema'

function primeiraMensagem(resultado: SafeParseReturnType<unknown, unknown>) {
  return resultado.success ? undefined : resultado.error.issues[0]!.message
}

describe('registrarSchema', () => {
  it('aceita um registro válido com nome', () => {
    expect(registrarSchema.safeParse({ email: 'a@b.com', senha: 'segredo', nome: 'Ana' }).success).toBe(true)
  })

  it('aceita um registro sem nome', () => {
    expect(registrarSchema.safeParse({ email: 'a@b.com', senha: 'segredo' }).success).toBe(true)
  })

  it('rejeita nome vazio', () => {
    expect(registrarSchema.safeParse({ email: 'a@b.com', senha: 'segredo', nome: '' }).success).toBe(false)
  })

  it('rejeita e-mail inválido no registro e no login com a mesma mensagem', () => {
    expect(primeiraMensagem(registrarSchema.safeParse({ email: 'invalido', senha: 'segredo' }))).toBe(
      'E-mail inválido.',
    )
    expect(primeiraMensagem(loginSchema.safeParse({ email: 'invalido', senha: 'segredo' }))).toBe(
      'E-mail inválido.',
    )
  })

  it('rejeita senha de 5 caracteres no registro', () => {
    expect(primeiraMensagem(registrarSchema.safeParse({ email: 'a@b.com', senha: '12345' }))).toBe(
      'A senha deve ter ao menos 6 caracteres.',
    )
  })

  it('aceita senha de 6 caracteres no registro', () => {
    expect(registrarSchema.safeParse({ email: 'a@b.com', senha: '123456' }).success).toBe(true)
  })
})

describe('loginSchema', () => {
  it('rejeita senha vazia', () => {
    expect(primeiraMensagem(loginSchema.safeParse({ email: 'a@b.com', senha: '' }))).toBe('Informe a senha.')
  })

  it('aceita senha de 1 caractere porque o login não exige tamanho mínimo', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', senha: 'x' }).success).toBe(true)
  })
})

describe('refreshSchema', () => {
  it('rejeita refreshToken vazio', () => {
    expect(primeiraMensagem(refreshSchema.safeParse({ refreshToken: '' }))).toBe('Informe o refresh token.')
  })

  it('rejeita refreshToken ausente', () => {
    expect(refreshSchema.safeParse({}).success).toBe(false)
  })
})
