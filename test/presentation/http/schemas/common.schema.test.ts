import type { SafeParseReturnType } from 'zod'
import { describe, expect, it } from 'vitest'

import {
  idOuProjetadoParamSchema,
  idParamSchema,
  resumoQuerySchema,
} from '../../../../src/presentation/http/schemas/common.schema'

const UUID = '123e4567-e89b-12d3-a456-426614174000'

function primeiraMensagem(resultado: SafeParseReturnType<unknown, unknown>) {
  return resultado.success ? undefined : resultado.error.issues[0]!.message
}

describe('idParamSchema', () => {
  it('aceita um UUID válido', () => {
    expect(idParamSchema.safeParse({ id: UUID }).success).toBe(true)
  })

  it('rejeita abc com a mensagem de identificador inválido', () => {
    expect(primeiraMensagem(idParamSchema.safeParse({ id: 'abc' }))).toBe('Identificador inválido.')
  })

  it('rejeita id projetado uuid_2026-09', () => {
    expect(idParamSchema.safeParse({ id: `${UUID}_2026-09` }).success).toBe(false)
  })
})

describe('idOuProjetadoParamSchema', () => {
  it('aceita um UUID', () => {
    expect(idOuProjetadoParamSchema.safeParse({ id: UUID }).success).toBe(true)
  })

  it('aceita id projetado uuid_2026-09, inclusive com UUID em maiúsculas', () => {
    expect(idOuProjetadoParamSchema.safeParse({ id: `${UUID}_2026-09` }).success).toBe(true)
    expect(idOuProjetadoParamSchema.safeParse({ id: `${UUID.toUpperCase()}_2026-09` }).success).toBe(true)
  })

  it('rejeita uuid_2026-9 e uuid_', () => {
    expect(idOuProjetadoParamSchema.safeParse({ id: `${UUID}_2026-9` }).success).toBe(false)
    expect(idOuProjetadoParamSchema.safeParse({ id: `${UUID}_` }).success).toBe(false)
  })

  it('rejeita id de fatura sai_fat_uuid', () => {
    expect(idOuProjetadoParamSchema.safeParse({ id: `sai_fat_${UUID}` }).success).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(idOuProjetadoParamSchema.safeParse({ id: '' }).success).toBe(false)
  })

  it('aceita 36 hífens porque a regex atual é frouxa (comportamento documentado)', () => {
    expect(idOuProjetadoParamSchema.safeParse({ id: '-'.repeat(36) }).success).toBe(true)
  })
})

describe('resumoQuerySchema', () => {
  it('aceita competencia 2026-09', () => {
    expect(resumoQuerySchema.safeParse({ competencia: '2026-09' }).success).toBe(true)
  })

  it('rejeita competencia 2026-9 e 09/2026 com a mensagem de formato', () => {
    for (const competencia of ['2026-9', '09/2026']) {
      expect(primeiraMensagem(resumoQuerySchema.safeParse({ competencia }))).toBe(
        'Competência inválida, use o formato YYYY-MM.',
      )
    }
  })

  it('rejeita competencia ausente', () => {
    expect(resumoQuerySchema.safeParse({}).success).toBe(false)
  })
})
