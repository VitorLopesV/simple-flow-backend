import type { SafeParseReturnType } from 'zod'
import { describe, expect, it } from 'vitest'

import { listarSaidasQuerySchema, saidaPayloadSchema } from '../../../../src/presentation/http/schemas/saida.schema'

const CATEGORIA_ID = '123e4567-e89b-12d3-a456-426614174000'

function payloadValido(sobrescritas: Record<string, unknown> = {}) {
  return {
    descricao: 'Aluguel',
    valor: 1500,
    data: '2026-09-10',
    categoriaId: CATEGORIA_ID,
    tipo: 'CONTA',
    status: 'PENDENTE',
    formaPagamento: 'PIX',
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

describe('saidaPayloadSchema', () => {
  it('aceita um payload completo válido', () => {
    const resultado = saidaPayloadSchema.safeParse(
      payloadValido({ vencimento: '2026-09-20', observacao: 'obs' }),
    )

    expect(resultado.success).toBe(true)
  })

  it('rejeita formaPagamento CARTAO_CREDITO com a mensagem da aba Cartões', () => {
    const resultado = saidaPayloadSchema.safeParse(payloadValido({ formaPagamento: 'CARTAO_CREDITO' }))

    expect(primeiraMensagem(resultado)).toBe('Gastos no cartão de crédito devem ser lançados na aba Cartões.')
  })

  it('rejeita formaPagamento fora do enum com a mesma mensagem', () => {
    const resultado = saidaPayloadSchema.safeParse(payloadValido({ formaPagamento: 'CHEQUE' }))

    expect(primeiraMensagem(resultado)).toBe('Gastos no cartão de crédito devem ser lançados na aba Cartões.')
  })

  it('aceita DINHEIRO, PIX, DEBITO e BOLETO', () => {
    for (const formaPagamento of ['DINHEIRO', 'PIX', 'DEBITO', 'BOLETO']) {
      expect(saidaPayloadSchema.safeParse(payloadValido({ formaPagamento })).success).toBe(true)
    }
  })

  it('rejeita valor 0 e -1 com a mensagem de valor positivo', () => {
    for (const valor of [0, -1]) {
      expect(primeiraMensagem(saidaPayloadSchema.safeParse(payloadValido({ valor })))).toBe(
        'O valor deve ser positivo.',
      )
    }
  })

  it('rejeita descricao vazia', () => {
    expect(primeiraMensagem(saidaPayloadSchema.safeParse(payloadValido({ descricao: '' })))).toBe(
      'Informe a descrição.',
    )
  })

  it('rejeita data em 2026-9-1 e 01/09/2026 com a mensagem de formato', () => {
    for (const data of ['2026-9-1', '01/09/2026']) {
      expect(primeiraMensagem(saidaPayloadSchema.safeParse(payloadValido({ data })))).toBe(
        'Data inválida, use o formato YYYY-MM-DD.',
      )
    }
  })

  it('aceita data 2026-13-45 porque a validação é só por regex', () => {
    expect(saidaPayloadSchema.safeParse(payloadValido({ data: '2026-13-45' })).success).toBe(true)
  })

  it('rejeita categoriaId que não é UUID', () => {
    expect(primeiraMensagem(saidaPayloadSchema.safeParse(payloadValido({ categoriaId: 'abc' })))).toBe(
      'Categoria inválida.',
    )
  })

  it('aceita cada tipo do enum, incluindo EDUCACAO e COMPRAS', () => {
    const tipos = ['TRANSPORTE', 'ALIMENTACAO', 'LAZER', 'CONTA', 'POUPANCA', 'ACOES', 'EDUCACAO', 'COMPRAS', 'OUTROS']

    for (const tipo of tipos) {
      expect(saidaPayloadSchema.safeParse(payloadValido({ tipo })).success).toBe(true)
    }
  })

  it('rejeita tipo inválido e status inválido', () => {
    expect(saidaPayloadSchema.safeParse(payloadValido({ tipo: 'VIAGEM' })).success).toBe(false)
    expect(saidaPayloadSchema.safeParse(payloadValido({ status: 'ATRASADO' })).success).toBe(false)
  })

  it('aceita vencimento omitido, null ou YYYY-MM-DD', () => {
    expect(saidaPayloadSchema.safeParse(payloadValido()).success).toBe(true)
    expect(saidaPayloadSchema.safeParse(payloadValido({ vencimento: null })).success).toBe(true)
    expect(saidaPayloadSchema.safeParse(payloadValido({ vencimento: '2026-09-20' })).success).toBe(true)
  })

  it('rejeita vencimento em formato inválido com a mensagem de vencimento', () => {
    expect(primeiraMensagem(saidaPayloadSchema.safeParse(payloadValido({ vencimento: '20/09/2026' })))).toBe(
      'Vencimento inválido, use o formato YYYY-MM-DD.',
    )
  })

  it('aceita observacao omitida, null ou string', () => {
    expect(saidaPayloadSchema.safeParse(payloadValido()).success).toBe(true)
    expect(saidaPayloadSchema.safeParse(payloadValido({ observacao: null })).success).toBe(true)
    expect(saidaPayloadSchema.safeParse(payloadValido({ observacao: 'texto' })).success).toBe(true)
  })

  it('rejeita recorrente não booleano ou campo obrigatório ausente', () => {
    const { descricao: _descricao, ...semDescricao } = payloadValido()

    expect(saidaPayloadSchema.safeParse(payloadValido({ recorrente: 'sim' })).success).toBe(false)
    expect(saidaPayloadSchema.safeParse(semDescricao).success).toBe(false)
  })
})

describe('listarSaidasQuerySchema', () => {
  it('coage mes e ano de string para número e aplica page 1 e pageSize 20 por padrão', () => {
    expect(listarSaidasQuerySchema.parse(queryValida())).toEqual({ mes: 9, ano: 2026, page: 1, pageSize: 20 })
  })

  it('rejeita mes 0 e 13 e aceita 1 e 12', () => {
    expect(listarSaidasQuerySchema.safeParse(queryValida({ mes: '0' })).success).toBe(false)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ mes: '13' })).success).toBe(false)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ mes: '1' })).success).toBe(true)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ mes: '12' })).success).toBe(true)
  })

  it('rejeita ano 1999 e aceita 2000', () => {
    expect(listarSaidasQuerySchema.safeParse(queryValida({ ano: '1999' })).success).toBe(false)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ ano: '2000' })).success).toBe(true)
  })

  it('rejeita page 0', () => {
    expect(listarSaidasQuerySchema.safeParse(queryValida({ page: '0' })).success).toBe(false)
  })

  it('rejeita pageSize 0 e 101 e aceita 100', () => {
    expect(listarSaidasQuerySchema.safeParse(queryValida({ pageSize: '0' })).success).toBe(false)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ pageSize: '101' })).success).toBe(false)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ pageSize: '100' })).success).toBe(true)
  })

  it('aceita status omitido, PAGO ou PENDENTE e rejeita outro valor', () => {
    expect(listarSaidasQuerySchema.safeParse(queryValida()).success).toBe(true)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ status: 'PAGO' })).success).toBe(true)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ status: 'PENDENTE' })).success).toBe(true)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ status: 'ATRASADO' })).success).toBe(false)
  })

  it('aceita categoriaId UUID ou omitido e rejeita inválido', () => {
    expect(listarSaidasQuerySchema.safeParse(queryValida()).success).toBe(true)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ categoriaId: CATEGORIA_ID })).success).toBe(true)
    expect(listarSaidasQuerySchema.safeParse(queryValida({ categoriaId: 'abc' })).success).toBe(false)
  })

  it('rejeita query sem mes ou sem ano', () => {
    expect(listarSaidasQuerySchema.safeParse({ ano: '2026' }).success).toBe(false)
    expect(listarSaidasQuerySchema.safeParse({ mes: '9' }).success).toBe(false)
  })
})
