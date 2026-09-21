import type { SafeParseReturnType } from 'zod'
import { describe, expect, it } from 'vitest'

import {
  cartaoIdParamSchema,
  cartaoPayloadSchema,
  faturaFiltroQuerySchema,
  transacaoCartaoParamsSchema,
  transacaoCartaoPayloadSchema,
} from '../../../../src/presentation/http/schemas/cartao.schema'

const UUID = '123e4567-e89b-12d3-a456-426614174000'

function cartaoValido(sobrescritas: Record<string, unknown> = {}) {
  return {
    nome: 'Nubank',
    bandeira: 'MASTERCARD',
    ultimosDigitos: '1234',
    limite: 5000,
    diaFechamento: 10,
    diaVencimento: 20,
    cor: '#820ad1',
    ativo: true,
    ...sobrescritas,
  }
}

function transacaoValida(sobrescritas: Record<string, unknown> = {}) {
  return {
    descricao: 'Mercado',
    valor: 200,
    data: '2026-09-15',
    categoriaId: UUID,
    tipo: 'ALIMENTACAO',
    parcelaAtual: 1,
    totalParcelas: 3,
    recorrente: false,
    ...sobrescritas,
  }
}

function primeiraMensagem(resultado: SafeParseReturnType<unknown, unknown>) {
  return resultado.success ? undefined : resultado.error.issues[0]!.message
}

describe('cartaoPayloadSchema', () => {
  it('aceita um cartão completo válido', () => {
    expect(cartaoPayloadSchema.safeParse(cartaoValido()).success).toBe(true)
  })

  it('rejeita bandeira fora do enum', () => {
    expect(cartaoPayloadSchema.safeParse(cartaoValido({ bandeira: 'DINERS' })).success).toBe(false)
  })

  it('rejeita ultimosDigitos 123, 12345 e abcd e aceita 0123', () => {
    for (const ultimosDigitos of ['123', '12345', 'abcd']) {
      expect(primeiraMensagem(cartaoPayloadSchema.safeParse(cartaoValido({ ultimosDigitos })))).toBe(
        'Informe os 4 últimos dígitos.',
      )
    }
    expect(cartaoPayloadSchema.safeParse(cartaoValido({ ultimosDigitos: '0123' })).success).toBe(true)
  })

  it('rejeita limite -1 e aceita 0', () => {
    expect(primeiraMensagem(cartaoPayloadSchema.safeParse(cartaoValido({ limite: -1 })))).toBe(
      'O limite não pode ser negativo.',
    )
    expect(cartaoPayloadSchema.safeParse(cartaoValido({ limite: 0 })).success).toBe(true)
  })

  it('rejeita diaFechamento 0, 32 e 1.5 e aceita 1 e 31', () => {
    for (const diaFechamento of [0, 32, 1.5]) {
      expect(cartaoPayloadSchema.safeParse(cartaoValido({ diaFechamento })).success).toBe(false)
    }
    for (const diaFechamento of [1, 31]) {
      expect(cartaoPayloadSchema.safeParse(cartaoValido({ diaFechamento })).success).toBe(true)
    }
  })

  it('rejeita diaVencimento 0 e 29 e aceita 1 e 28', () => {
    for (const diaVencimento of [0, 29]) {
      expect(cartaoPayloadSchema.safeParse(cartaoValido({ diaVencimento })).success).toBe(false)
    }
    for (const diaVencimento of [1, 28]) {
      expect(cartaoPayloadSchema.safeParse(cartaoValido({ diaVencimento })).success).toBe(true)
    }
  })

  it('rejeita nome vazio', () => {
    expect(primeiraMensagem(cartaoPayloadSchema.safeParse(cartaoValido({ nome: '' })))).toBe(
      'Informe o nome do cartão.',
    )
  })

  it('rejeita cor vazia ou ativo não booleano', () => {
    expect(cartaoPayloadSchema.safeParse(cartaoValido({ cor: '' })).success).toBe(false)
    expect(cartaoPayloadSchema.safeParse(cartaoValido({ ativo: 'sim' })).success).toBe(false)
  })
})

describe('faturaFiltroQuerySchema', () => {
  it('aceita competencia 2026-09', () => {
    expect(faturaFiltroQuerySchema.safeParse({ competencia: '2026-09' }).success).toBe(true)
  })

  it('rejeita competencia 2026-9 e 09/2026 com a mensagem de formato', () => {
    for (const competencia of ['2026-9', '09/2026']) {
      expect(primeiraMensagem(faturaFiltroQuerySchema.safeParse({ competencia }))).toBe(
        'Competência inválida, use o formato YYYY-MM.',
      )
    }
  })

  it('aceita cartaoId omitido ou UUID e rejeita inválido', () => {
    expect(faturaFiltroQuerySchema.safeParse({ competencia: '2026-09' }).success).toBe(true)
    expect(faturaFiltroQuerySchema.safeParse({ competencia: '2026-09', cartaoId: UUID }).success).toBe(true)
    expect(faturaFiltroQuerySchema.safeParse({ competencia: '2026-09', cartaoId: 'abc' }).success).toBe(false)
  })
})

describe('transacaoCartaoPayloadSchema', () => {
  it('aceita uma transação válida', () => {
    expect(transacaoCartaoPayloadSchema.safeParse(transacaoValida()).success).toBe(true)
  })

  it('assume 1 para parcelaAtual e totalParcelas quando omitidos', () => {
    const { parcelaAtual: _parcelaAtual, totalParcelas: _totalParcelas, ...semParcelas } = transacaoValida()

    const resultado = transacaoCartaoPayloadSchema.parse(semParcelas)

    expect(resultado).toMatchObject({ parcelaAtual: 1, totalParcelas: 1 })
  })

  it('rejeita parcelaAtual 0 ou totalParcelas 0', () => {
    expect(transacaoCartaoPayloadSchema.safeParse(transacaoValida({ parcelaAtual: 0 })).success).toBe(false)
    expect(transacaoCartaoPayloadSchema.safeParse(transacaoValida({ totalParcelas: 0 })).success).toBe(false)
  })

  it('rejeita valor 0 ou negativo com a mensagem de valor positivo', () => {
    for (const valor of [0, -10]) {
      expect(primeiraMensagem(transacaoCartaoPayloadSchema.safeParse(transacaoValida({ valor })))).toBe(
        'O valor deve ser positivo.',
      )
    }
  })

  it('rejeita tipo fora do enum da transação', () => {
    expect(transacaoCartaoPayloadSchema.safeParse(transacaoValida({ tipo: 'VIAGEM' })).success).toBe(false)
  })

  it('remove formaPagamento e status enviados na transação', () => {
    const resultado = transacaoCartaoPayloadSchema.parse(
      transacaoValida({ formaPagamento: 'PIX', status: 'PAGO' }),
    )

    expect(resultado).not.toHaveProperty('formaPagamento')
    expect(resultado).not.toHaveProperty('status')
  })

  it('rejeita recorrente ausente', () => {
    const { recorrente: _recorrente, ...semRecorrente } = transacaoValida()

    expect(transacaoCartaoPayloadSchema.safeParse(semRecorrente).success).toBe(false)
  })
})

describe('cartaoIdParamSchema', () => {
  it('rejeita cartaoId que não é UUID com a mensagem de cartão inválido', () => {
    expect(primeiraMensagem(cartaoIdParamSchema.safeParse({ cartaoId: 'abc' }))).toBe('Cartão inválido.')
  })
})

describe('transacaoCartaoParamsSchema', () => {
  it('rejeita id que não é UUID com a mensagem de identificador inválido', () => {
    expect(primeiraMensagem(transacaoCartaoParamsSchema.safeParse({ cartaoId: UUID, id: 'abc' }))).toBe(
      'Identificador inválido.',
    )
  })
})
