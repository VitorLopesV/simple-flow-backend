import { describe, expect, it } from 'vitest'

import {
  addMeses,
  dentroDoPeriodo,
  labelCurtoPeriodo,
  limitesDoMes,
  mesAnterior,
  paraCompetencia,
  paraPeriodo,
  ultimosPeriodos,
} from '../../../src/shared/utils/periodo'

describe('paraCompetencia', () => {
  it('completa o mês com zero à esquerda', () => {
    expect(paraCompetencia({ mes: 3, ano: 2026 })).toBe('2026-03')
  })

  it('mantém mês de dois dígitos', () => {
    expect(paraCompetencia({ mes: 12, ano: 2026 })).toBe('2026-12')
  })
})

describe('paraPeriodo', () => {
  it('converte competência em mês e ano', () => {
    expect(paraPeriodo('2026-03')).toEqual({ mes: 3, ano: 2026 })
  })

  it('devolve o período original na ida e volta com paraCompetencia', () => {
    const periodo = { mes: 7, ano: 2025 }

    expect(paraPeriodo(paraCompetencia(periodo))).toEqual(periodo)
  })
})

describe('dentroDoPeriodo', () => {
  it('retorna true para datas do mês, inclusive primeiro e último dia', () => {
    const setembro = { mes: 9, ano: 2026 }

    expect(dentroDoPeriodo('2026-09-15', setembro)).toBe(true)
    expect(dentroDoPeriodo('2026-09-01', setembro)).toBe(true)
    expect(dentroDoPeriodo('2026-09-30', setembro)).toBe(true)
  })

  it('retorna false para mês diferente ou ano diferente', () => {
    const setembro = { mes: 9, ano: 2026 }

    expect(dentroDoPeriodo('2026-10-01', setembro)).toBe(false)
    expect(dentroDoPeriodo('2025-09-15', setembro)).toBe(false)
  })
})

describe('limitesDoMes', () => {
  it('retorna 01 e 28 para fevereiro de 2026', () => {
    expect(limitesDoMes({ mes: 2, ano: 2026 })).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' })
  })

  it('retorna fim 29 para fevereiro de 2024 (bissexto)', () => {
    expect(limitesDoMes({ mes: 2, ano: 2024 }).fim).toBe('2024-02-29')
  })

  it('retorna fim 31 para dezembro', () => {
    expect(limitesDoMes({ mes: 12, ano: 2026 }).fim).toBe('2026-12-31')
  })
})

describe('addMeses', () => {
  it('avança de dezembro para janeiro do ano seguinte', () => {
    expect(addMeses({ mes: 12, ano: 2026 }, 1)).toEqual({ mes: 1, ano: 2027 })
  })

  it('volta de janeiro para dezembro do ano anterior', () => {
    expect(addMeses({ mes: 1, ano: 2026 }, -1)).toEqual({ mes: 12, ano: 2025 })
  })

  it('soma 13, subtrai 12 e mantém o período com 0', () => {
    const periodo = { mes: 5, ano: 2026 }

    expect(addMeses(periodo, 13)).toEqual({ mes: 6, ano: 2027 })
    expect(addMeses(periodo, -12)).toEqual({ mes: 5, ano: 2025 })
    expect(addMeses(periodo, 0)).toEqual(periodo)
  })
})

describe('mesAnterior', () => {
  it('volta de janeiro para dezembro do ano anterior', () => {
    expect(mesAnterior({ mes: 1, ano: 2026 })).toEqual({ mes: 12, ano: 2025 })
  })
})

describe('ultimosPeriodos', () => {
  it('retorna 6 períodos em ordem cronológica de abril a setembro de 2026', () => {
    expect(ultimosPeriodos({ mes: 9, ano: 2026 }, 6)).toEqual([
      { mes: 4, ano: 2026 },
      { mes: 5, ano: 2026 },
      { mes: 6, ano: 2026 },
      { mes: 7, ano: 2026 },
      { mes: 8, ano: 2026 },
      { mes: 9, ano: 2026 },
    ])
  })

  it('atravessa o ano de setembro de 2025 a fevereiro de 2026', () => {
    expect(ultimosPeriodos({ mes: 2, ano: 2026 }, 6)).toEqual([
      { mes: 9, ano: 2025 },
      { mes: 10, ano: 2025 },
      { mes: 11, ano: 2025 },
      { mes: 12, ano: 2025 },
      { mes: 1, ano: 2026 },
      { mes: 2, ano: 2026 },
    ])
  })

  it('retorna apenas o próprio período quando n é 1', () => {
    expect(ultimosPeriodos({ mes: 9, ano: 2026 }, 1)).toEqual([{ mes: 9, ano: 2026 }])
  })
})

describe('labelCurtoPeriodo', () => {
  it('formata agosto de 2026 como ago/26', () => {
    expect(labelCurtoPeriodo({ mes: 8, ano: 2026 })).toBe('ago/26')
  })

  it('formata janeiro e dezembro e os 12 rótulos corretamente', () => {
    const rotulos = Array.from({ length: 12 }, (_, i) => labelCurtoPeriodo({ mes: i + 1, ano: 2026 }))

    expect(rotulos[0]).toBe('jan/26')
    expect(rotulos[11]).toBe('dez/26')
    expect(rotulos).toEqual([
      'jan/26', 'fev/26', 'mar/26', 'abr/26', 'mai/26', 'jun/26',
      'jul/26', 'ago/26', 'set/26', 'out/26', 'nov/26', 'dez/26',
    ])
  })
})
