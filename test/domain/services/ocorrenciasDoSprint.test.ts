import { describe, expect, it } from 'vitest'

import type { ItemRotina } from '../../../src/domain/entities/ItemRotina'
import { calcularOcorrenciasDoSprint } from '../../../src/domain/services/ocorrenciasDoSprint'

function item(sobrescritas: Partial<ItemRotina>): ItemRotina {
  return {
    id: 'rot-1',
    areaId: 'area-rotina',
    nome: 'Tomar remédio',
    repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 3] },
    vezes: [{ hora: '20:00' }, { hora: '08:00' }, { hora: null }],
    criadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

// 2026-11-16 é segunda; 21 = sábado, 22 = domingo.
describe('calcularOcorrenciasDoSprint', () => {
  it('uma ocorrência por vez do dia, com índice e ordem estáveis (sem hora primeiro)', () => {
    const { ocorrencias, lembretes } = calcularOcorrenciasDoSprint([item({})], '2026-11-16')

    expect(lembretes).toEqual([])
    expect(ocorrencias.map((o) => [o.data, o.hora, o.indice, o.ordem])).toEqual([
      ['2026-11-16', null, 0, 0],
      ['2026-11-16', '08:00', 1, 1],
      ['2026-11-16', '20:00', 2, 2],
      ['2026-11-18', null, 0, 3],
      ['2026-11-18', '08:00', 1, 4],
      ['2026-11-18', '20:00', 2, 5],
    ])
    expect(ocorrencias[0]).toMatchObject({ itemId: 'rot-1', nome: 'Tomar remédio' })
  })

  it('intercala itens do mesmo dia por hora e nome', () => {
    const { ocorrencias } = calcularOcorrenciasDoSprint(
      [
        item({ id: 'b', nome: 'Lixo', repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1] }, vezes: [{ hora: '08:00' }] }),
        item({ id: 'a', nome: 'Água', repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1] }, vezes: [{ hora: '08:00' }] }),
        item({ id: 'c', nome: 'Alongar', repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1] }, vezes: [{ hora: null }] }),
      ],
      '2026-11-16',
    )
    expect(ocorrencias.map((o) => o.nome)).toEqual(['Alongar', 'Água', 'Lixo'])
    expect(ocorrencias.map((o) => o.ordem)).toEqual([0, 1, 2])
  })

  it('a cada N dias: sábado e domingo viram lembretes e não entram nas ocorrências do sprint', () => {
    const { ocorrencias, lembretes } = calcularOcorrenciasDoSprint(
      [item({ repeticao: { modo: 'A_CADA_N_DIAS', intervalo: 2, dataInicial: '2026-11-16' }, vezes: [{ hora: null }] })],
      '2026-11-16',
    )
    expect(ocorrencias.map((o) => o.data)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20'])
    expect(lembretes.map((o) => o.data)).toEqual(['2026-11-22'])
    expect(lembretes[0]).toMatchObject({ ordem: 0, indice: 0 })
  })

  it('não inclui dias de fora da semana e aceita rotina vazia', () => {
    expect(calcularOcorrenciasDoSprint([], '2026-11-16')).toEqual({ ocorrencias: [], lembretes: [] })
    const { ocorrencias } = calcularOcorrenciasDoSprint(
      [item({ repeticao: { modo: 'A_CADA_N_DIAS', intervalo: 7, dataInicial: '2026-11-09' }, vezes: [{ hora: null }] })],
      '2026-11-16',
    )
    expect(ocorrencias.map((o) => o.data)).toEqual(['2026-11-16'])
  })

  it('desempata por item e índice quando data, hora e nome coincidem', () => {
    const { ocorrencias } = calcularOcorrenciasDoSprint(
      [
        item({ id: 'z', repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1] }, vezes: [{ hora: null }, { hora: null }] }),
        item({ id: 'y', repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1] }, vezes: [{ hora: null }] }),
      ],
      '2026-11-16',
    )
    expect(ocorrencias.map((o) => [o.itemId, o.indice])).toEqual([['y', 0], ['z', 0], ['z', 1]])
  })
})
