import { describe, expect, it } from 'vitest'

import { agruparPorTipo } from '../../../src/shared/utils/agrupamento'

describe('agruparPorTipo', () => {
  it('soma os valores por tipo e ordena do maior para o menor total', () => {
    const resultado = agruparPorTipo([
      { tipo: 'ALIMENTACAO', valor: 40 },
      { tipo: 'CONTA', valor: 300 },
      { tipo: 'ALIMENTACAO', valor: 58 },
    ])

    expect(resultado).toEqual([
      { tipo: 'CONTA', total: 300 },
      { tipo: 'ALIMENTACAO', total: 98 },
    ])
  })

  it('omite tipos sem saídas no período', () => {
    const resultado = agruparPorTipo([{ tipo: 'LAZER', valor: 10 }])

    expect(resultado.map((item) => item.tipo)).toEqual(['LAZER'])
  })

  it('retorna lista vazia quando não há saídas', () => {
    expect(agruparPorTipo([])).toEqual([])
  })

  it('mantém a soma dos totais igual à soma das saídas', () => {
    const saidas = [
      { tipo: 'TRANSPORTE' as const, valor: 12.5 },
      { tipo: 'OUTROS' as const, valor: 7.25 },
      { tipo: 'TRANSPORTE' as const, valor: 30 },
    ]

    const somaGrupos = agruparPorTipo(saidas).reduce((soma, item) => soma + item.total, 0)
    const somaSaidas = saidas.reduce((soma, saida) => soma + saida.valor, 0)

    expect(somaGrupos).toBeCloseTo(somaSaidas)
  })
})
