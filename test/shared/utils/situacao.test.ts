import { describe, expect, it } from 'vitest'

import { correspondeASituacao, estaVencida } from '../../../src/shared/utils/situacao'

const HOJE = '2026-10-08'

describe('estaVencida', () => {
  it('pendente com vencimento anterior a hoje está vencida', () => {
    expect(estaVencida({ status: 'PENDENTE', vencimento: '2026-10-07' }, HOJE)).toBe(true)
    expect(estaVencida({ status: 'PENDENTE', vencimento: '2025-12-31' }, HOJE)).toBe(true)
  })

  it('vencer hoje ou depois ainda está no prazo', () => {
    expect(estaVencida({ status: 'PENDENTE', vencimento: HOJE }, HOJE)).toBe(false)
    expect(estaVencida({ status: 'PENDENTE', vencimento: '2026-10-09' }, HOJE)).toBe(false)
  })

  it('sem vencimento nunca vence', () => {
    expect(estaVencida({ status: 'PENDENTE', vencimento: null }, HOJE)).toBe(false)
    expect(estaVencida({ status: 'PENDENTE', vencimento: undefined }, HOJE)).toBe(false)
    expect(estaVencida({ status: 'PENDENTE', vencimento: '' }, HOJE)).toBe(false)
  })

  it('saída paga não vence, mesmo com vencimento passado', () => {
    expect(estaVencida({ status: 'PAGO', vencimento: '2026-10-01' }, HOJE)).toBe(false)
  })
})

describe('correspondeASituacao', () => {
  const vencida = { status: 'PENDENTE', vencimento: '2026-10-01' } as const
  const noPrazo = { status: 'PENDENTE', vencimento: '2026-10-20' } as const
  const semVencimento = { status: 'PENDENTE', vencimento: null } as const
  const paga = { status: 'PAGO', vencimento: '2026-10-01' } as const

  it('PENDENTE não inclui as vencidas', () => {
    expect(correspondeASituacao(vencida, 'PENDENTE', HOJE)).toBe(false)
    expect(correspondeASituacao(noPrazo, 'PENDENTE', HOJE)).toBe(true)
    expect(correspondeASituacao(semVencimento, 'PENDENTE', HOJE)).toBe(true)
    expect(correspondeASituacao(paga, 'PENDENTE', HOJE)).toBe(false)
  })

  it('VENCIDO inclui só pendentes com vencimento passado', () => {
    expect(correspondeASituacao(vencida, 'VENCIDO', HOJE)).toBe(true)
    expect(correspondeASituacao(noPrazo, 'VENCIDO', HOJE)).toBe(false)
    expect(correspondeASituacao(semVencimento, 'VENCIDO', HOJE)).toBe(false)
    expect(correspondeASituacao(paga, 'VENCIDO', HOJE)).toBe(false)
  })

  it('PAGO inclui só as pagas', () => {
    expect(correspondeASituacao(paga, 'PAGO', HOJE)).toBe(true)
    expect(correspondeASituacao(vencida, 'PAGO', HOJE)).toBe(false)
    expect(correspondeASituacao(noPrazo, 'PAGO', HOJE)).toBe(false)
  })
})
