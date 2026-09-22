import { describe, expect, it } from 'vitest'

import { calcularDatasFatura } from '../../../src/shared/utils/fatura'

describe('calcularDatasFatura', () => {
  it('calcula fechamento e vencimento no mesmo mês quando o vencimento é maior que o fechamento', () => {
    expect(calcularDatasFatura({ diaFechamento: 10, diaVencimento: 20 }, '2026-09')).toEqual({
      fechamento: '2026-09-10',
      vencimento: '2026-09-20',
    })
  })

  it('joga o vencimento para o mês seguinte quando é menor que o fechamento', () => {
    expect(calcularDatasFatura({ diaFechamento: 25, diaVencimento: 5 }, '2026-09')).toEqual({
      fechamento: '2026-09-25',
      vencimento: '2026-10-05',
    })
  })

  it('joga o vencimento para o mês seguinte quando é igual ao fechamento', () => {
    expect(calcularDatasFatura({ diaFechamento: 10, diaVencimento: 10 }, '2026-09')).toEqual({
      fechamento: '2026-09-10',
      vencimento: '2026-10-10',
    })
  })

  it('joga o vencimento para janeiro do ano seguinte na competência de dezembro', () => {
    expect(calcularDatasFatura({ diaFechamento: 25, diaVencimento: 5 }, '2026-12')).toEqual({
      fechamento: '2026-12-25',
      vencimento: '2027-01-05',
    })
    expect(calcularDatasFatura({ diaFechamento: 10, diaVencimento: 10 }, '2026-12').vencimento).toBe('2027-01-10')
  })

  it('ajusta fechamento dia 31 para 28 em fevereiro de 2026', () => {
    expect(calcularDatasFatura({ diaFechamento: 31, diaVencimento: 10 }, '2026-02').fechamento).toBe('2026-02-28')
  })

  it('ajusta fechamento dia 31 para 29 em fevereiro de 2024 (bissexto)', () => {
    expect(calcularDatasFatura({ diaFechamento: 31, diaVencimento: 10 }, '2024-02').fechamento).toBe('2024-02-29')
  })

  it('ajusta fechamento dia 31 para 30 em abril', () => {
    expect(calcularDatasFatura({ diaFechamento: 31, diaVencimento: 10 }, '2026-04').fechamento).toBe('2026-04-30')
  })

  it('mantém fechamento 31 em janeiro e vencimento 5 no mês seguinte', () => {
    expect(calcularDatasFatura({ diaFechamento: 31, diaVencimento: 5 }, '2026-01')).toEqual({
      fechamento: '2026-01-31',
      vencimento: '2026-02-05',
    })
  })

  it('mantém vencimento 28 em fevereiro quando o fechamento é 10', () => {
    expect(calcularDatasFatura({ diaFechamento: 10, diaVencimento: 28 }, '2026-02').vencimento).toBe('2026-02-28')
  })
})
