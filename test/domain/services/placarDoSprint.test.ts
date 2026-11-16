import { describe, expect, it } from 'vitest'

import type { TarefaDoSprint } from '../../../src/domain/entities/PlacarDoSprint'
import { calcularPlacar } from '../../../src/domain/services/placarDoSprint'

const INICIO = '2026-11-16'
const FIM = '2026-11-20'
const FEITA = '2026-11-16T15:00:00.000Z'
const DIAS = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']

/** 1 h difícil alta = 15 pontos, salvo override. */
function tarefa(extra: Partial<TarefaDoSprint> = {}): TarefaDoSprint {
  return {
    id: 't',
    dia: '2026-11-17',
    tempoEstimado: 60,
    dificuldade: 'DIFICIL',
    prioridade: 'ALTA',
    concluida: false,
    atrasada: false,
    superTask: false,
    ...extra,
  }
}

describe('calcularPlacar', () => {
  it('sprint vazio: total 0, percentual 0 e sem bônus (sem dividir por zero)', () => {
    expect(calcularPlacar([], [], INICIO, FIM)).toMatchObject({ total: 0, feitos: 0, percentual: 0, bonus: false })
  })

  it('rotina: dia cumprido só com todas as ocorrências concluídas; dia sem rotina é ignorado', () => {
    const placar = calcularPlacar(
      [
        { data: '2026-11-16', concluidaEm: FEITA },
        { data: '2026-11-16', concluidaEm: FEITA },
        { data: '2026-11-17', concluidaEm: FEITA },
        { data: '2026-11-17', concluidaEm: null },
      ],
      [],
      INICIO,
      FIM,
    )
    expect(placar.rotina).toEqual({ diasComRotina: 2, diasCumpridos: 1, pontosPorDia: 40, total: 80, feitos: 40 })
    expect(placar).toMatchObject({ total: 80, feitos: 40, percentual: 50, bonus: false })
  })

  it('total = 40 × dias com rotina + pontos das tarefas; feitos só dos concluídos', () => {
    const placar = calcularPlacar(
      [{ data: '2026-11-16', concluidaEm: FEITA }],
      [tarefa({ concluida: true }), tarefa({ id: 'u', tempoEstimado: 240 })],
      INICIO,
      FIM,
    )
    expect(placar).toMatchObject({ total: 40 + 15 + 39, feitos: 40 + 15 })
    expect(placar.tarefas).toEqual({ quantidade: 2, concluidas: 1, total: 54, feitos: 15 })
  })

  it('tarefa atrasada concluída soma 20% nos feitos e vale o cheio no total', () => {
    const placar = calcularPlacar([], [tarefa({ concluida: true, atrasada: true })], INICIO, FIM)
    expect(placar).toMatchObject({ total: 15, feitos: 3 })
  })

  it('super task nunca pontua', () => {
    const placar = calcularPlacar([], [tarefa({ superTask: true, concluida: true })], INICIO, FIM)
    expect(placar).toMatchObject({ total: 0, feitos: 0 })
  })

  it('sábado e domingo nunca pontuam, nem rotina nem tarefa', () => {
    const placar = calcularPlacar(
      [
        { data: '2026-11-21', concluidaEm: FEITA },
        { data: '2026-11-22', concluidaEm: FEITA },
        { data: '2026-11-23', concluidaEm: FEITA },
      ],
      [tarefa({ dia: '2026-11-21', concluida: true }), tarefa({ dia: '2026-11-22' }), tarefa({ dia: '2026-11-23' })],
      INICIO,
      '2026-11-23',
    )
    expect(placar).toMatchObject({ total: 40 + 15, feitos: 40 })
  })

  it('ignora ocorrências e tarefas fora do intervalo do sprint', () => {
    const placar = calcularPlacar(
      [{ data: '2026-11-23', concluidaEm: FEITA }],
      [tarefa({ dia: '2026-11-23', concluida: true })],
      INICIO,
      FIM,
    )
    expect(placar.total).toBe(0)
  })

  it('bônus liberado a partir de 90% e negado abaixo', () => {
    const rotina = (cumpridos: number) => DIAS.map((data, i) => ({ data, concluidaEm: i < cumpridos ? FEITA : null }))
    const grandes = (feitas: number) =>
      Array.from({ length: 20 }, (_, i) =>
        tarefa({ id: String(i), tempoEstimado: 240, concluida: i < feitas, dia: DIAS[i % 5]! }),
      )
    // total = 5 × 40 + 20 × 39 = 980; 90% = 882
    expect(calcularPlacar(rotina(5), grandes(17), INICIO, FIM)).toMatchObject({ total: 980, feitos: 863, bonus: false })
    expect(calcularPlacar(rotina(5), grandes(18), INICIO, FIM)).toMatchObject({ feitos: 902, bonus: true })
    expect(calcularPlacar(rotina(5), grandes(20), INICIO, FIM)).toMatchObject({ percentual: 100, bonus: true })
  })

  it('exatamente 90% libera o bônus', () => {
    const pequenas = Array.from({ length: 20 }, (_, i) =>
      tarefa({ id: String(i), tempoEstimado: 15, dificuldade: 'FACIL', prioridade: 'BAIXA', concluida: i < 18 }),
    )
    // 20 × 2 = 40 no total; 18 × 2 = 36 feitos = 90%
    expect(calcularPlacar([], pequenas, INICIO, FIM)).toMatchObject({ total: 40, feitos: 36, percentual: 90, bonus: true })
    expect(calcularPlacar([], pequenas.map((t, i) => ({ ...t, concluida: i < 17 })), INICIO, FIM).bonus).toBe(false)
  })

  it('arredonda o percentual em uma casa decimal', () => {
    const placar = calcularPlacar([{ data: '2026-11-16', concluidaEm: FEITA }], [tarefa()], INICIO, FIM)
    expect(placar).toMatchObject({ total: 55, feitos: 40, percentual: 72.7 })
  })
})
