import { describe, expect, it } from 'vitest'

import {
  camposFaltantes,
  ehDiaUtil,
  fimDoSprint,
  inicioDoSprintDoDia,
  motivoDeRecusa,
  tarefaTravada,
} from '../../../src/domain/services/sprintDaTarefa'

// 2026-11-18 é quarta; o sprint atual é 16–20 e o próximo é 23–27.
const HOJE = '2026-11-18'
const COMPLETA = { dia: '2026-11-18', tempoEstimado: 60 as const, dificuldade: 'MEDIA' as const, prioridade: 'ALTA' as const }

describe('sprintDaTarefa', () => {
  it('ehDiaUtil: segunda a sexta sim, sábado e domingo não', () => {
    expect(['2026-11-16', '2026-11-20'].every(ehDiaUtil)).toBe(true)
    expect(ehDiaUtil('2026-11-21')).toBe(false)
    expect(ehDiaUtil('2026-11-22')).toBe(false)
  })

  it('inicioDoSprintDoDia / fimDoSprint: semana de segunda a sexta', () => {
    expect(inicioDoSprintDoDia('2026-11-20')).toBe('2026-11-16')
    expect(fimDoSprint('2026-11-16')).toBe('2026-11-20')
  })

  it('camposFaltantes lista o que falta, na ordem; a hora não conta', () => {
    expect(camposFaltantes({ tempoEstimado: null, dificuldade: null, prioridade: null })).toEqual([
      'tempo estimado',
      'dificuldade',
      'prioridade',
    ])
    expect(camposFaltantes(COMPLETA)).toEqual([])
  })

  describe('motivoDeRecusa', () => {
    it('aceita hoje e dias futuros do sprint atual e do próximo', () => {
      for (const dia of ['2026-11-18', '2026-11-20', '2026-11-23', '2026-11-27']) {
        expect(motivoDeRecusa({ ...COMPLETA, dia }, HOJE)).toBeNull()
      }
    })

    it('recusa sem dia, com mensagem clara', () => {
      expect(motivoDeRecusa({ ...COMPLETA, dia: null }, HOJE)).toBe('Escolha um dia, de segunda a sexta, para a tarefa entrar no sprint.')
    })

    it('recusa sábado e domingo', () => {
      expect(motivoDeRecusa({ ...COMPLETA, dia: '2026-11-21' }, HOJE)).toMatch(/Sábado e domingo/)
      expect(motivoDeRecusa({ ...COMPLETA, dia: '2026-11-22' }, HOJE)).toMatch(/Sábado e domingo/)
    })

    it('recusa dia que já passou, mesmo dentro do sprint atual', () => {
      expect(motivoDeRecusa({ ...COMPLETA, dia: '2026-11-17' }, HOJE)).toMatch(/já passou/)
    })

    it('recusa semanas além do próximo sprint e semanas passadas', () => {
      expect(motivoDeRecusa({ ...COMPLETA, dia: '2026-11-30' }, HOJE)).toBe('Só dá para planejar o sprint desta semana e o da próxima.')
      expect(motivoDeRecusa({ ...COMPLETA, dia: '2026-11-09' }, HOJE)).toMatch(/já passou/)
    })

    it('diz exatamente o que falta de pontuação', () => {
      expect(motivoDeRecusa({ ...COMPLETA, tempoEstimado: null }, HOJE)).toBe('Para entrar no sprint, defina antes: tempo estimado.')
      expect(motivoDeRecusa({ ...COMPLETA, dificuldade: null, prioridade: null }, HOJE)).toBe(
        'Para entrar no sprint, defina antes: dificuldade, prioridade.',
      )
    })

    it('no fim de semana, o sprint atual já acabou: só a próxima semana aceita', () => {
      const sabado = '2026-11-21'
      expect(motivoDeRecusa({ ...COMPLETA, dia: '2026-11-20' }, sabado)).toMatch(/já passou/)
      expect(motivoDeRecusa({ ...COMPLETA, dia: '2026-11-23' }, sabado)).toBeNull()
      expect(motivoDeRecusa({ ...COMPLETA, dia: '2026-11-30' }, sabado)).toMatch(/desta semana e o da próxima/)
    })
  })

  describe('tarefaTravada', () => {
    it('só trava tarefa no sprint cujo dia ficou para trás', () => {
      expect(tarefaTravada({ sprintId: 's', dia: '2026-11-17' }, HOJE)).toBe(true)
      expect(tarefaTravada({ sprintId: 's', dia: HOJE }, HOJE)).toBe(false)
      expect(tarefaTravada({ sprintId: 's', dia: '2026-11-19' }, HOJE)).toBe(false)
      expect(tarefaTravada({ sprintId: null, dia: '2026-11-17' }, HOJE)).toBe(false)
      expect(tarefaTravada({ sprintId: 's', dia: null }, HOJE)).toBe(false)
    })
  })
})
