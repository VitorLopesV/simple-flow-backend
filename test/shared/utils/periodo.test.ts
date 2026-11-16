import { describe, expect, it } from 'vitest'

import {
  addDias,
  addMinutos,
  dataHoraAtual,
  addMeses,
  competenciaAtual,
  dataAtual,
  dentroDoPeriodo,
  labelCurtoPeriodo,
  limitesDoMes,
  mesAnterior,
  paraCompetencia,
  paraPeriodo,
  segundaDaSemana,
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

describe('competenciaAtual', () => {
  it('usa o fuso de São Paulo', () => {
    expect(competenciaAtual(new Date('2026-09-15T15:00:00.000Z'))).toBe('2026-09')
    // 30/09 às 21h30 em São Paulo — em UTC já é 01/10.
    expect(competenciaAtual(new Date('2026-10-01T00:30:00.000Z'))).toBe('2026-09')
    expect(competenciaAtual(new Date('2026-10-01T03:00:00.000Z'))).toBe('2026-10')
  })
})

describe('dataAtual', () => {
  it('usa o fuso de São Paulo', () => {
    expect(dataAtual(new Date('2026-09-15T15:00:00.000Z'))).toBe('2026-09-15')
    // 30/09 às 21h30 em São Paulo — em UTC já é 01/10.
    expect(dataAtual(new Date('2026-10-01T00:30:00.000Z'))).toBe('2026-09-30')
    expect(dataAtual(new Date('2026-10-01T03:00:00.000Z'))).toBe('2026-10-01')
  })
})

describe('addDias', () => {
  it('soma e subtrai dias atravessando mês e ano', () => {
    expect(addDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDias('2026-11-16', 0)).toBe('2026-11-16')
  })
})

describe('segundaDaSemana', () => {
  // 2026-11-16 é segunda.
  it.each([
    ['2026-11-16', '2026-11-16'],
    ['2026-11-18', '2026-11-16'],
    ['2026-11-20', '2026-11-16'],
    ['2026-11-21', '2026-11-16'],
    ['2026-11-22', '2026-11-16'],
    ['2026-11-23', '2026-11-23'],
    ['2027-01-01', '2026-12-28'],
  ])('%s -> %s', (data, segunda) => {
    expect(segundaDaSemana(data)).toBe(segunda)
  })

  it('domingo 23:59 em São Paulo ainda é a semana que acaba; segunda 00:00 já é a nova', () => {
    expect(segundaDaSemana(dataAtual(new Date('2026-11-23T02:59:59Z')))).toBe('2026-11-16')
    expect(segundaDaSemana(dataAtual(new Date('2026-11-23T03:00:00Z')))).toBe('2026-11-23')
  })

  it('sexta 23:59 em São Paulo ainda é sexta; sábado 00:00 continua na mesma semana', () => {
    expect(dataAtual(new Date('2026-11-21T02:59:59Z'))).toBe('2026-11-20')
    expect(dataAtual(new Date('2026-11-21T03:00:00Z'))).toBe('2026-11-21')
    expect(segundaDaSemana('2026-11-21')).toBe('2026-11-16')
  })
})

describe('dataHoraAtual e addMinutos', () => {
  it('dataHoraAtual devolve o relógio de São Paulo, inclusive na virada de dia e meia-noite', () => {
    expect(dataHoraAtual(new Date('2026-11-16T15:30:05.000Z'))).toBe('2026-11-16T12:30:05')
    expect(dataHoraAtual(new Date('2026-11-17T02:59:59.000Z'))).toBe('2026-11-16T23:59:59')
    expect(dataHoraAtual(new Date('2026-11-17T03:00:00.000Z'))).toBe('2026-11-17T00:00:00')
  })

  it('addMinutos soma sem fuso, atravessando a meia-noite; aceita com e sem segundos', () => {
    expect(addMinutos('2026-11-16T12:00', 15)).toBe('2026-11-16T12:15:00')
    expect(addMinutos('2026-11-16T23:50:30', 15)).toBe('2026-11-17T00:05:30')
  })
})
