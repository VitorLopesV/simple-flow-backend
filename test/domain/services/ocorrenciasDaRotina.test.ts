import { describe, expect, it } from 'vitest'

import type { ItemRotina } from '../../../src/domain/entities/ItemRotina'
import { calcularOcorrencias } from '../../../src/domain/services/ocorrenciasDaRotina'

type Regra = Pick<ItemRotina, 'repeticao' | 'vezes'>

const UMA_VEZ = [{ hora: null }]
const datas = (ocorrencias: { data: string }[]) => ocorrencias.map((o) => o.data)
const VAZIO = { diasUteis: [], lembretesFimDeSemana: [] }

// 2026-11-16 é segunda-feira; 21 = sábado, 22 = domingo.
describe('calcularOcorrencias — dias da semana', () => {
  const segQuaSex: Regra = { repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 3, 5] }, vezes: UMA_VEZ }

  it('devolve só os dias marcados no intervalo, inclusive nas pontas', () => {
    const r = calcularOcorrencias(segQuaSex, '2026-11-16', '2026-11-22')
    expect(datas(r.diasUteis)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20'])
    expect(r.lembretesFimDeSemana).toEqual([])
  })

  it('todos os dias úteis: nunca gera sábado nem domingo', () => {
    const r = calcularOcorrencias(
      { repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 2, 3, 4, 5] }, vezes: UMA_VEZ },
      '2026-11-16',
      '2026-11-29',
    )
    expect(r.diasUteis).toHaveLength(10)
    expect(r.lembretesFimDeSemana).toEqual([])
  })

  it('atravessa a virada do ano (31/12/2026 é quinta)', () => {
    const r = calcularOcorrencias(
      { repeticao: { modo: 'DIAS_DA_SEMANA', dias: [4] }, vezes: UMA_VEZ },
      '2026-12-28',
      '2027-01-08',
    )
    expect(datas(r.diasUteis)).toEqual(['2026-12-31', '2027-01-07'])
  })

  it('intervalo de um único dia e intervalo invertido', () => {
    expect(datas(calcularOcorrencias(segQuaSex, '2026-11-18', '2026-11-18').diasUteis)).toEqual(['2026-11-18'])
    expect(calcularOcorrencias(segQuaSex, '2026-11-17', '2026-11-17')).toEqual(VAZIO)
    expect(calcularOcorrencias(segQuaSex, '2026-11-22', '2026-11-16')).toEqual(VAZIO)
  })

  it('funciona em ano bissexto (29/02/2028 é terça) e antes de 1970 (01/01/1960 foi sexta)', () => {
    const bissexto = calcularOcorrencias(
      { repeticao: { modo: 'DIAS_DA_SEMANA', dias: [2] }, vezes: UMA_VEZ },
      '2028-02-28',
      '2028-03-01',
    )
    expect(datas(bissexto.diasUteis)).toEqual(['2028-02-29'])

    const antigo = calcularOcorrencias(
      { repeticao: { modo: 'DIAS_DA_SEMANA', dias: [5] }, vezes: UMA_VEZ },
      '1960-01-01',
      '1960-01-03',
    )
    expect(datas(antigo.diasUteis)).toEqual(['1960-01-01'])
  })
})

describe('calcularOcorrencias — a cada N dias', () => {
  const aCada = (intervalo: number, dataInicial: string): Regra => ({
    repeticao: { modo: 'A_CADA_N_DIAS', intervalo, dataInicial },
    vezes: UMA_VEZ,
  })

  it('todo dia (N = 1): fim de semana vira lembrete', () => {
    const r = calcularOcorrencias(aCada(1, '2026-11-16'), '2026-11-16', '2026-11-22')
    expect(datas(r.diasUteis)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'])
    expect(datas(r.lembretesFimDeSemana)).toEqual(['2026-11-21', '2026-11-22'])
  })

  it('a cada 3 dias atravessando fins de semana, separando úteis de lembretes', () => {
    // 16 (seg), 19 (qui), 22 (dom), 25 (qua), 28 (sáb), 01/12 (ter)
    const r = calcularOcorrencias(aCada(3, '2026-11-16'), '2026-11-16', '2026-12-01')
    expect(datas(r.diasUteis)).toEqual(['2026-11-16', '2026-11-19', '2026-11-25', '2026-12-01'])
    expect(datas(r.lembretesFimDeSemana)).toEqual(['2026-11-22', '2026-11-28'])
  })

  it('a cada 15 dias, atravessando meses e a virada do ano', () => {
    // 16/11 seg, 01/12 ter, 16/12 qua, 31/12 qui, 15/01 sex, 30/01 sáb
    const r = calcularOcorrencias(aCada(15, '2026-11-16'), '2026-11-01', '2027-01-31')
    expect(datas(r.diasUteis)).toEqual(['2026-11-16', '2026-12-01', '2026-12-16', '2026-12-31', '2027-01-15'])
    expect(datas(r.lembretesFimDeSemana)).toEqual(['2027-01-30'])
  })

  it('a série começa na data inicial: nada antes dela', () => {
    const r = calcularOcorrencias(aCada(2, '2026-11-18'), '2026-11-10', '2026-11-23')
    expect(datas(r.diasUteis)).toEqual(['2026-11-18', '2026-11-20'])
    expect(datas(r.lembretesFimDeSemana)).toEqual(['2026-11-22'])
  })

  it('janela começando no meio da série mantém a fase dos múltiplos de N', () => {
    // Série: 16, 19, 22, 25, 28 — a janela de 20 a 26 pega 22 (dom) e 25 (qua).
    const r = calcularOcorrencias(aCada(3, '2026-11-16'), '2026-11-20', '2026-11-26')
    expect(datas(r.diasUteis)).toEqual(['2026-11-25'])
    expect(datas(r.lembretesFimDeSemana)).toEqual(['2026-11-22'])
  })

  it('janela começando exatamente numa ocorrência a inclui', () => {
    const r = calcularOcorrencias(aCada(3, '2026-11-16'), '2026-11-19', '2026-11-19')
    expect(datas(r.diasUteis)).toEqual(['2026-11-19'])
  })

  it('janela inteira antes da data inicial: vazio', () => {
    expect(calcularOcorrencias(aCada(2, '2026-12-01'), '2026-11-01', '2026-11-30')).toEqual(VAZIO)
  })

  it('data inicial no fim de semana começa como lembrete', () => {
    const r = calcularOcorrencias(aCada(7, '2026-11-21'), '2026-11-21', '2026-12-05')
    expect(r.diasUteis).toEqual([])
    expect(datas(r.lembretesFimDeSemana)).toEqual(['2026-11-21', '2026-11-28', '2026-12-05'])
  })
})

describe('calcularOcorrencias — várias vezes ao dia', () => {
  it('cada vez é uma ocorrência separada, em ordem de hora, sem hora primeiro', () => {
    const r = calcularOcorrencias(
      {
        repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 2] },
        vezes: [{ hora: '20:00' }, { hora: null }, { hora: '08:00' }],
      },
      '2026-11-16',
      '2026-11-17',
    )
    expect(r.diasUteis).toEqual([
      { data: '2026-11-16', hora: null },
      { data: '2026-11-16', hora: '08:00' },
      { data: '2026-11-16', hora: '20:00' },
      { data: '2026-11-17', hora: null },
      { data: '2026-11-17', hora: '08:00' },
      { data: '2026-11-17', hora: '20:00' },
    ])
  })

  it('no modo a cada N dias, o lembrete de fim de semana também se repete por vez', () => {
    const r = calcularOcorrencias(
      {
        repeticao: { modo: 'A_CADA_N_DIAS', intervalo: 7, dataInicial: '2026-11-21' },
        vezes: [{ hora: '08:00' }, { hora: '20:00' }],
      },
      '2026-11-21',
      '2026-11-21',
    )
    expect(r.diasUteis).toEqual([])
    expect(r.lembretesFimDeSemana).toEqual([
      { data: '2026-11-21', hora: '08:00' },
      { data: '2026-11-21', hora: '20:00' },
    ])
  })

  it('não altera a ordem das vezes do item', () => {
    const vezes = [{ hora: '20:00' }, { hora: '08:00' }]
    calcularOcorrencias({ repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1] }, vezes }, '2026-11-16', '2026-11-16')
    expect(vezes).toEqual([{ hora: '20:00' }, { hora: '08:00' }])
  })
})
