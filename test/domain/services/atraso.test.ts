import { describe, expect, it } from 'vitest'

import { tarefaAtrasada } from '../../../src/domain/services/atraso'

// São Paulo = UTC-3 (sem horário de verão). Segunda 2026-11-16.
const sp = (dataHora: string) => new Date(`${dataHora}-03:00`)
const COM_HORA = { dia: '2026-11-16', hora: '12:00', tempoEstimado: 15 }
const SEM_HORA = { dia: '2026-11-16', hora: null, tempoEstimado: 60 }

describe('tarefaAtrasada', () => {
  describe('com hora', () => {
    it('concluída às 12:30 de uma tarefa 12:00 + 15 min está atrasada (exemplo da issue)', () => {
      expect(tarefaAtrasada(COM_HORA, sp('2026-11-16T12:30:00'))).toBe(true)
    })

    it('exatamente no instante limite (12:15:00) não está atrasada; um segundo depois, está', () => {
      expect(tarefaAtrasada(COM_HORA, sp('2026-11-16T12:15:00'))).toBe(false)
      expect(tarefaAtrasada(COM_HORA, sp('2026-11-16T12:15:01'))).toBe(true)
    })

    it('antes do início ou dentro da janela não está atrasada', () => {
      expect(tarefaAtrasada(COM_HORA, sp('2026-11-16T08:00:00'))).toBe(false)
      expect(tarefaAtrasada(COM_HORA, sp('2026-11-16T12:10:00'))).toBe(false)
    })

    it('hora aceita HH:MM:SS (como vem do banco)', () => {
      expect(tarefaAtrasada({ ...COM_HORA, hora: '12:00:00' }, sp('2026-11-16T12:16:00'))).toBe(true)
    })

    it('virada de dia: tarefa 23:50 + 15 min vence às 00:05 do dia seguinte', () => {
      const tarefa = { dia: '2026-11-16', hora: '23:50', tempoEstimado: 15 as const }
      expect(tarefaAtrasada(tarefa, sp('2026-11-17T00:05:00'))).toBe(false)
      expect(tarefaAtrasada(tarefa, sp('2026-11-17T00:06:00'))).toBe(true)
    })

    it('concluída em outro dia, depois do limite, está atrasada', () => {
      expect(tarefaAtrasada(COM_HORA, sp('2026-11-18T09:00:00'))).toBe(true)
    })

    it('sem tempo estimado, o limite é a própria hora', () => {
      const tarefa = { dia: '2026-11-16', hora: '12:00', tempoEstimado: null }
      expect(tarefaAtrasada(tarefa, sp('2026-11-16T12:00:00'))).toBe(false)
      expect(tarefaAtrasada(tarefa, sp('2026-11-16T12:00:01'))).toBe(true)
    })
  })

  describe('sem hora', () => {
    it('concluída em qualquer horário do próprio dia não está atrasada, inclusive 23:59:59', () => {
      expect(tarefaAtrasada(SEM_HORA, sp('2026-11-16T00:00:00'))).toBe(false)
      expect(tarefaAtrasada(SEM_HORA, sp('2026-11-16T23:59:59'))).toBe(false)
    })

    it('virada 23:59 → 00:00: a partir da meia-noite de São Paulo está atrasada', () => {
      expect(tarefaAtrasada(SEM_HORA, sp('2026-11-16T23:59:00'))).toBe(false)
      expect(tarefaAtrasada(SEM_HORA, sp('2026-11-17T00:00:00'))).toBe(true)
    })

    it('antes do dia da tarefa não está atrasada', () => {
      expect(tarefaAtrasada(SEM_HORA, sp('2026-11-13T10:00:00'))).toBe(false)
    })
  })

  describe('fuso', () => {
    it('23:30 em São Paulo ainda é o dia da tarefa, mesmo já sendo o dia seguinte em UTC', () => {
      const instante = new Date('2026-11-17T02:30:00.000Z') // 23:30 de segunda em SP
      expect(tarefaAtrasada(SEM_HORA, instante)).toBe(false)
    })

    it('02:59 UTC é 23:59 de SP; 03:00 UTC é 00:00 do dia seguinte em SP', () => {
      expect(tarefaAtrasada(SEM_HORA, new Date('2026-11-17T02:59:00.000Z'))).toBe(false)
      expect(tarefaAtrasada(SEM_HORA, new Date('2026-11-17T03:00:00.000Z'))).toBe(true)
    })

    it('o limite com hora é em horário de SP, não em UTC', () => {
      // 12:00 SP + 15 min = 15:15 UTC.
      expect(tarefaAtrasada(COM_HORA, new Date('2026-11-16T15:15:00.000Z'))).toBe(false)
      expect(tarefaAtrasada(COM_HORA, new Date('2026-11-16T15:16:00.000Z'))).toBe(true)
      // 12:30 UTC seria 09:30 em SP: bem antes do início.
      expect(tarefaAtrasada(COM_HORA, new Date('2026-11-16T12:30:00.000Z'))).toBe(false)
    })
  })

  it('replanejada para outra data: o prazo é o dia atual da tarefa', () => {
    const concluida = sp('2026-11-18T10:00:00')
    expect(tarefaAtrasada({ ...SEM_HORA, dia: '2026-11-16' }, concluida)).toBe(true)
    expect(tarefaAtrasada({ ...SEM_HORA, dia: '2026-11-23' }, concluida)).toBe(false)
  })

  it('sem dia não há prazo', () => {
    expect(tarefaAtrasada({ dia: null, hora: null, tempoEstimado: 15 }, sp('2026-11-16T12:30:00'))).toBe(false)
  })
})
