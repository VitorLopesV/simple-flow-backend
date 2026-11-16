import { describe, expect, it } from 'vitest'

import { CONFIGURACAO_PONTUACAO, pontosDaTarefa } from '../../../src/domain/services/pontuacao'

describe('pontosDaTarefa', () => {
  it('1 h difícil alta = 15', () => {
    expect(pontosDaTarefa({ tempoEstimado: 60, dificuldade: 'DIFICIL', prioridade: 'ALTA' })).toBe(15)
  })

  it('4 h difícil alta = 39 (teto)', () => {
    expect(pontosDaTarefa({ tempoEstimado: 240, dificuldade: 'DIFICIL', prioridade: 'ALTA' })).toBe(39)
  })

  it('15 min fácil baixa = 2', () => {
    expect(pontosDaTarefa({ tempoEstimado: 15, dificuldade: 'FACIL', prioridade: 'BAIXA' })).toBe(2)
  })

  it('atrasada vale 20% arredondado', () => {
    expect(pontosDaTarefa({ tempoEstimado: 60, dificuldade: 'DIFICIL', prioridade: 'ALTA' }, true)).toBe(3)
    expect(pontosDaTarefa({ tempoEstimado: 240, dificuldade: 'DIFICIL', prioridade: 'ALTA' }, true)).toBe(8)
    expect(pontosDaTarefa({ tempoEstimado: 15, dificuldade: 'FACIL', prioridade: 'BAIXA' }, true)).toBe(0)
  })

  it('arredonda multiplicadores fracionários (30 min média média = 5,4 → 5)', () => {
    expect(pontosDaTarefa({ tempoEstimado: 30, dificuldade: 'MEDIA', prioridade: 'MEDIA' })).toBe(5)
  })

  it('a tabela de base cobre todos os tempos', () => {
    expect(CONFIGURACAO_PONTUACAO.baseDoTempo).toEqual({ 15: 2, 30: 3, 60: 5, 120: 8, 240: 13 })
  })
})
