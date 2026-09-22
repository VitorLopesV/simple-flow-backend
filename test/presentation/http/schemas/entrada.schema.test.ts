import type { SafeParseReturnType } from 'zod'
import { describe, expect, it } from 'vitest'

import {
  entradaPayloadSchema,
  listarEntradasQuerySchema,
} from '../../../../src/presentation/http/schemas/entrada.schema'

const CATEGORIA_ID = '123e4567-e89b-12d3-a456-426614174000'

function payloadValido(sobrescritas: Record<string, unknown> = {}) {
  return {
    descricao: 'Salário',
    valor: 5000,
    data: '2026-09-05',
    categoriaId: CATEGORIA_ID,
    recorrente: false,
    ...sobrescritas,
  }
}

function queryValida(sobrescritas: Record<string, unknown> = {}) {
  return { mes: '9', ano: '2026', ...sobrescritas }
}

function primeiraMensagem(resultado: SafeParseReturnType<unknown, unknown>) {
  return resultado.success ? undefined : resultado.error.issues[0]!.message
}

describe('entradaPayloadSchema', () => {
  it('aceita um payload completo válido', () => {
    expect(entradaPayloadSchema.safeParse(payloadValido({ observacao: 'obs' })).success).toBe(true)
  })

  it('rejeita valor 0 e -1 com a mensagem de valor positivo', () => {
    for (const valor of [0, -1]) {
      expect(primeiraMensagem(entradaPayloadSchema.safeParse(payloadValido({ valor })))).toBe(
        'O valor deve ser positivo.',
      )
    }
  })

  it('rejeita descricao vazia', () => {
    expect(primeiraMensagem(entradaPayloadSchema.safeParse(payloadValido({ descricao: '' })))).toBe(
      'Informe a descrição.',
    )
  })

  it('rejeita data em formato inválido com a mensagem de formato', () => {
    expect(primeiraMensagem(entradaPayloadSchema.safeParse(payloadValido({ data: '01/09/2026' })))).toBe(
      'Data inválida, use o formato YYYY-MM-DD.',
    )
  })

  it('rejeita categoriaId que não é UUID', () => {
    expect(primeiraMensagem(entradaPayloadSchema.safeParse(payloadValido({ categoriaId: 'abc' })))).toBe(
      'Categoria inválida.',
    )
  })

  it('rejeita recorrente ausente ou não booleano', () => {
    const { recorrente: _recorrente, ...semRecorrente } = payloadValido()

    expect(entradaPayloadSchema.safeParse(semRecorrente).success).toBe(false)
    expect(entradaPayloadSchema.safeParse(payloadValido({ recorrente: 'sim' })).success).toBe(false)
  })

  it('aceita observacao omitida, null ou string', () => {
    expect(entradaPayloadSchema.safeParse(payloadValido()).success).toBe(true)
    expect(entradaPayloadSchema.safeParse(payloadValido({ observacao: null })).success).toBe(true)
    expect(entradaPayloadSchema.safeParse(payloadValido({ observacao: 'texto' })).success).toBe(true)
  })

  it('remove campo extra do resultado parseado', () => {
    const resultado = entradaPayloadSchema.parse(payloadValido({ tipo: 'CONTA' }))

    expect(resultado).not.toHaveProperty('tipo')
  })
})

describe('listarEntradasQuerySchema', () => {
  it('coage mes e ano de string para número e aplica page 1 e pageSize 20 por padrão', () => {
    expect(listarEntradasQuerySchema.parse(queryValida())).toEqual({ mes: 9, ano: 2026, page: 1, pageSize: 20 })
  })

  it('rejeita mes 0 e 13 e aceita 1 e 12', () => {
    expect(listarEntradasQuerySchema.safeParse(queryValida({ mes: '0' })).success).toBe(false)
    expect(listarEntradasQuerySchema.safeParse(queryValida({ mes: '13' })).success).toBe(false)
    expect(listarEntradasQuerySchema.safeParse(queryValida({ mes: '1' })).success).toBe(true)
    expect(listarEntradasQuerySchema.safeParse(queryValida({ mes: '12' })).success).toBe(true)
  })

  it('rejeita ano 1999 e aceita 2000', () => {
    expect(listarEntradasQuerySchema.safeParse(queryValida({ ano: '1999' })).success).toBe(false)
    expect(listarEntradasQuerySchema.safeParse(queryValida({ ano: '2000' })).success).toBe(true)
  })

  it('rejeita pageSize 101 e page 0 e aceita pageSize 100', () => {
    expect(listarEntradasQuerySchema.safeParse(queryValida({ pageSize: '101' })).success).toBe(false)
    expect(listarEntradasQuerySchema.safeParse(queryValida({ pageSize: '100' })).success).toBe(true)
    expect(listarEntradasQuerySchema.safeParse(queryValida({ page: '0' })).success).toBe(false)
  })

  it('aceita categoriaId UUID ou omitido e rejeita inválido', () => {
    expect(listarEntradasQuerySchema.safeParse(queryValida()).success).toBe(true)
    expect(listarEntradasQuerySchema.safeParse(queryValida({ categoriaId: CATEGORIA_ID })).success).toBe(true)
    expect(listarEntradasQuerySchema.safeParse(queryValida({ categoriaId: 'abc' })).success).toBe(false)
  })
})
