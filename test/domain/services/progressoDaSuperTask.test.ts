import { describe, expect, it } from 'vitest'

import { calcularProgresso, todasConcluidas } from '../../../src/domain/services/progressoDaSuperTask'

const feita = { concluida: true }
const aberta = { concluida: false }
const HOJE = '2026-11-18'

describe('todasConcluidas', () => {
  it('exige ao menos uma filha e todas concluídas', () => {
    expect(todasConcluidas([])).toBe(false)
    expect(todasConcluidas([feita, aberta])).toBe(false)
    expect(todasConcluidas([feita, feita])).toBe(true)
  })
})

describe('calcularProgresso', () => {
  const sem = { concluida: false, dataTermino: null }

  it('sem filhas: 0% e não iniciada, sem poder concluir', () => {
    expect(calcularProgresso(sem, [], HOJE)).toMatchObject({
      totalFilhas: 0,
      filhasConcluidas: 0,
      progresso: 0,
      estado: 'NAO_INICIADA',
      podeConcluir: false,
    })
  })

  it('nenhuma filha concluída: 0% e não iniciada', () => {
    expect(calcularProgresso(sem, [aberta, aberta], HOJE)).toMatchObject({ progresso: 0, estado: 'NAO_INICIADA' })
  })

  it('1 a 99%: em andamento, arredondando para baixo', () => {
    expect(calcularProgresso(sem, [feita, aberta, aberta], HOJE)).toMatchObject({ progresso: 33, estado: 'EM_ANDAMENTO' })
    const muitas = [...Array.from({ length: 199 }, () => feita), aberta]
    expect(calcularProgresso(sem, muitas, HOJE)).toMatchObject({ progresso: 99, estado: 'EM_ANDAMENTO', podeConcluir: false })
  })

  it('100% sem estar marcada (reaberta): em andamento, mas pode ser marcada de novo', () => {
    expect(calcularProgresso(sem, [feita, feita], HOJE)).toMatchObject({
      progresso: 100,
      estado: 'EM_ANDAMENTO',
      podeConcluir: true,
    })
  })

  it('marcada concluída: estado concluída e não pode concluir de novo', () => {
    expect(calcularProgresso({ concluida: true, dataTermino: null }, [feita], HOJE)).toMatchObject({
      progresso: 100,
      estado: 'CONCLUIDA',
      podeConcluir: false,
    })
  })

  it('vencida só quando a data de término passou e ela não está concluída', () => {
    expect(calcularProgresso({ concluida: false, dataTermino: '2026-11-17' }, [aberta], HOJE).vencida).toBe(true)
    expect(calcularProgresso({ concluida: false, dataTermino: HOJE }, [aberta], HOJE).vencida).toBe(false)
    expect(calcularProgresso({ concluida: false, dataTermino: null }, [aberta], HOJE).vencida).toBe(false)
    expect(calcularProgresso({ concluida: true, dataTermino: '2026-11-17' }, [feita], HOJE).vencida).toBe(false)
  })
})
