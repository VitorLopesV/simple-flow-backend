import type { SafeParseReturnType } from 'zod'
import { describe, expect, it } from 'vitest'

import {
  TAMANHO_MAXIMO_FOTO_BYTES,
  atualizarPerfilSchema,
  loginSchema,
  refreshSchema,
  registrarSchema,
} from '../../../../src/presentation/http/schemas/auth.schema'

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

describe('registrarSchema — telefone', () => {
  it('aceita telefone com 10 ou 11 dígitos, nulo ou ausente', () => {
    for (const telefone of ['1133334444', '11999998888', null, undefined]) {
      expect(registrarSchema.safeParse({ email: 'a@b.com', senha: 'segredo', telefone }).success).toBe(true)
    }
  })

  it('rejeita telefone com máscara ou tamanho errado', () => {
    for (const telefone of ['(11) 99999-8888', '119999988', '119999988881']) {
      expect(primeiraMensagem(registrarSchema.safeParse({ email: 'a@b.com', senha: 'segredo', telefone }))).toBe(
        'Telefone inválido, informe só os números com DDD (10 ou 11 dígitos).',
      )
    }
  })
})

/** Data URL JPEG com `bytes` bytes decodificados. */
function fotoCom(bytes: number) {
  return `data:image/jpeg;base64,${Buffer.alloc(bytes, 1).toString('base64')}`
}

describe('atualizarPerfilSchema', () => {
  it('aceita o corpo completo do contrato', () => {
    const corpo = { nome: 'Ana Souza', email: 'ana.souza@exemplo.com', telefone: '11999998888', fotoUrl: fotoCom(20_000) }

    expect(atualizarPerfilSchema.parse(corpo)).toEqual(corpo)
  })

  it('aceita atualização parcial e corpo vazio', () => {
    expect(atualizarPerfilSchema.parse({ telefone: '1133334444' })).toEqual({ telefone: '1133334444' })
    expect(atualizarPerfilSchema.parse({})).toEqual({})
  })

  it('aceita null em telefone e fotoUrl para remover os dados', () => {
    expect(atualizarPerfilSchema.parse({ telefone: null, fotoUrl: null })).toEqual({ telefone: null, fotoUrl: null })
  })

  it('descarta campos desconhecidos, como um id', () => {
    expect(atualizarPerfilSchema.parse({ id: 'outro-usuario', nome: 'Ana' })).toEqual({ nome: 'Ana' })
  })

  it('remove espaços das pontas do nome', () => {
    expect(atualizarPerfilSchema.parse({ nome: '  Ana  ' })).toEqual({ nome: 'Ana' })
  })

  it.each([
    ['1 caractere', 'A'],
    ['só espaços', '     '],
    ['61 caracteres', 'a'.repeat(61)],
    ['null', null],
  ])('rejeita nome com %s', (_caso, nome) => {
    expect(primeiraMensagem(atualizarPerfilSchema.safeParse({ nome }))).toBe('O nome deve ter entre 2 e 60 caracteres.')
  })

  it('aceita nome com 2 e com 60 caracteres', () => {
    expect(atualizarPerfilSchema.safeParse({ nome: 'Al' }).success).toBe(true)
    expect(atualizarPerfilSchema.safeParse({ nome: 'a'.repeat(60) }).success).toBe(true)
  })

  it('rejeita e-mail inválido', () => {
    expect(primeiraMensagem(atualizarPerfilSchema.safeParse({ email: 'ana@' }))).toBe('E-mail inválido.')
  })

  it('rejeita telefone inválido', () => {
    expect(primeiraMensagem(atualizarPerfilSchema.safeParse({ telefone: '11 99999-8888' }))).toBe(
      'Telefone inválido, informe só os números com DDD (10 ou 11 dígitos).',
    )
  })

  it.each([
    ['URL http', 'https://exemplo.com/foto.jpg'],
    ['data URL que não é imagem', 'data:text/plain;base64,QUJD'],
    ['imagem sem base64', 'data:image/jpeg,abc'],
    ['base64 com caractere inválido', 'data:image/png;base64,AB$C'],
  ])('rejeita foto em formato inválido (%s)', (_caso, fotoUrl) => {
    expect(primeiraMensagem(atualizarPerfilSchema.safeParse({ fotoUrl }))).toBe(
      'Foto inválida, envie uma imagem JPEG, PNG ou WebP.',
    )
  })

  it('aceita PNG e WebP', () => {
    expect(atualizarPerfilSchema.safeParse({ fotoUrl: 'data:image/png;base64,QUJD' }).success).toBe(true)
    expect(atualizarPerfilSchema.safeParse({ fotoUrl: 'data:image/webp;base64,QUI=' }).success).toBe(true)
  })

  it('aceita foto com exatamente o tamanho máximo', () => {
    expect(atualizarPerfilSchema.safeParse({ fotoUrl: fotoCom(TAMANHO_MAXIMO_FOTO_BYTES) }).success).toBe(true)
  })

  it('rejeita foto acima de 500 KB com mensagem clara', () => {
    expect(primeiraMensagem(atualizarPerfilSchema.safeParse({ fotoUrl: fotoCom(TAMANHO_MAXIMO_FOTO_BYTES + 1) }))).toBe(
      'A foto deve ter no máximo 500 KB.',
    )
  })
})
