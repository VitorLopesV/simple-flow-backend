import { describe, expect, it } from 'vitest'

import { MENSAGEM_SPRINT_FECHADO, sprintVencido } from '../../../src/domain/services/fechamentoDoSprint'
import { motivoDeRecusa } from '../../../src/domain/services/sprintDaTarefa'

const FIM = '2026-11-20' // sexta-feira

describe('sprintVencido', () => {
  it('o fechamento é sexta 23:59:00 em SP = sábado 02:59:00 UTC, no instante exato', () => {
    expect(sprintVencido(FIM, new Date('2026-11-21T02:58:59Z'))).toBe(false) // 23:58:59 SP
    expect(sprintVencido(FIM, new Date('2026-11-21T02:59:00Z'))).toBe(true) // 23:59:00 SP
    expect(sprintVencido(FIM, new Date('2026-11-21T02:59:01Z'))).toBe(true)
  })

  it('virada sexta 23:59 → sábado 00:00 (SP): vencido nos dois lados da meia-noite', () => {
    expect(sprintVencido(FIM, new Date('2026-11-21T02:59:30Z'))).toBe(true) // sexta 23:59:30 SP
    expect(sprintVencido(FIM, new Date('2026-11-21T03:00:00Z'))).toBe(true) // sábado 00:00:00 SP
  })

  it('durante a semana e na sexta antes de 23:59 o sprint ainda está aberto', () => {
    expect(sprintVencido(FIM, new Date('2026-11-16T03:00:00Z'))).toBe(false) // segunda 00:00 SP
    expect(sprintVencido(FIM, new Date('2026-11-20T14:00:00Z'))).toBe(false)
  })

  it('semanas depois continua vencido (reserva no primeiro acesso)', () => {
    expect(sprintVencido(FIM, new Date('2026-12-03T12:00:00Z'))).toBe(true)
  })

  it('não confunde o UTC com SP: sexta 23:00 UTC (20:00 SP) ainda não venceu', () => {
    expect(sprintVencido(FIM, new Date('2026-11-20T23:00:00Z'))).toBe(false)
  })
})

describe('motivoDeRecusa com sprint vencido', () => {
  const tarefa = { dia: '2026-11-20', tempoEstimado: 60, dificuldade: 'FACIL', prioridade: 'BAIXA' } as const

  it('sexta depois de 23:59 SP: o sprint fechou, o dia de hoje não aceita tarefa', () => {
    const agora = new Date('2026-11-21T02:59:00Z')
    expect(motivoDeRecusa(tarefa, '2026-11-20', agora)).toBe(MENSAGEM_SPRINT_FECHADO)
  })

  it('sexta às 23:58 SP ainda aceita; sem `agora` a regra de fechamento não se aplica', () => {
    expect(motivoDeRecusa(tarefa, '2026-11-20', new Date('2026-11-21T02:58:59Z'))).toBeNull()
    expect(motivoDeRecusa(tarefa, '2026-11-20')).toBeNull()
  })

  it('o sprint seguinte continua aceitando tarefas', () => {
    const agora = new Date('2026-11-21T10:00:00Z')
    expect(motivoDeRecusa({ ...tarefa, dia: '2026-11-23' }, '2026-11-21', agora)).toBeNull()
  })
})
