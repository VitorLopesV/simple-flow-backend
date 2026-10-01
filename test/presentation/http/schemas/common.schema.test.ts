import type { SafeParseReturnType } from 'zod'
import { describe, expect, it } from 'vitest'

import {
  confirmacaoQuerySchema,
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

  it('rejeita o antigo id sintético de projeção uuid_2026-09', () => {
    expect(idParamSchema.safeParse({ id: `${UUID}_2026-09` }).success).toBe(false)
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

describe('confirmacaoQuerySchema', () => {
  it('converte "true" em true e "false" ou ausente em false', () => {
    expect(confirmacaoQuerySchema.parse({ confirmar: 'true' })).toEqual({ confirmar: true })
    expect(confirmacaoQuerySchema.parse({ confirmar: 'false' })).toEqual({ confirmar: false })
    expect(confirmacaoQuerySchema.parse({})).toEqual({ confirmar: false })
  })

  it('rejeita outros valores com mensagem em português', () => {
    expect(primeiraMensagem(confirmacaoQuerySchema.safeParse({ confirmar: 'sim' }))).toBe(
      'Confirmação inválida, use true ou false.',
    )
  })
})
