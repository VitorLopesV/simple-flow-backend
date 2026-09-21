import { describe, expect, it } from 'vitest'

import { calcularVariacao } from '../../../src/shared/utils/variacao'

describe('calcularVariacao', () => {
  it('retorna 0.1 quando o atual é 110 e o anterior 100', () => {
    expect(calcularVariacao(110, 100)).toBeCloseTo(0.1)
  })

  it('retorna -0.1 quando o atual é 90 e o anterior 100', () => {
    expect(calcularVariacao(90, 100)).toBeCloseTo(-0.1)
  })

  it('retorna 0 quando atual e anterior são iguais', () => {
    expect(calcularVariacao(100, 100)).toBe(0)
  })

  it('retorna -1 quando o atual é 0 e o anterior 100', () => {
    expect(calcularVariacao(0, 100)).toBeCloseTo(-1)
  })

  it('retorna 1 quando o anterior é 0 e o atual positivo', () => {
    expect(calcularVariacao(50, 0)).toBe(1)
  })

  it('retorna 0 quando anterior e atual são 0', () => {
    expect(calcularVariacao(0, 0)).toBe(0)
  })

  it('retorna 0 quando o anterior é 0 e o atual negativo', () => {
    expect(calcularVariacao(-50, 0)).toBe(0)
  })

  it('usa o módulo do anterior no divisor quando o anterior é negativo', () => {
    expect(calcularVariacao(-50, -100)).toBeCloseTo(0.5)
  })
})
