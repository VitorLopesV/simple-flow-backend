import { describe, expect, it } from 'vitest'

import type { TarefaDoSprint } from '../../../src/domain/entities/PlacarDoSprint'
import { montarFoto, recompensaEfetiva } from '../../../src/domain/services/fotoDoSprint'

const INICIO = '2026-11-16'
const FIM = '2026-11-20'

function tarefa(extra: Partial<TarefaDoSprint> = {}): TarefaDoSprint {
  return {
    id: 't1',
    titulo: 'Tarefa',
    dia: '2026-11-17',
    hora: null,
    tempoEstimado: 60,
    dificuldade: 'DIFICIL',
    prioridade: 'ALTA',
    concluida: false,
    atrasada: false,
    superTask: false,
    ...extra,
  }
}

function ocorrencia(data: string, concluida: boolean, extra: Record<string, unknown> = {}) {
  return { id: `${data}-${extra.nome ?? 'a'}`, nome: 'Remédio', data, hora: '08:00', ordem: 0, lembrete: false, concluidaEm: concluida ? `${data}T12:00:00Z` : null, ...extra }
}

describe('recompensaEfetiva', () => {
  it('usa a do sprint, senão a padrão, senão nulo; vazio conta como ausente', () => {
    expect(recompensaEfetiva('Pizza', 'Cinema')).toBe('Pizza')
    expect(recompensaEfetiva(null, 'Cinema')).toBe('Cinema')
    expect(recompensaEfetiva('  ', ' Cinema ')).toBe('Cinema')
    expect(recompensaEfetiva(null, null)).toBeNull()
    expect(recompensaEfetiva('', '')).toBeNull()
  })
})

describe('montarFoto', () => {
  it('mantém o placar e acrescenta recompensa e detalhe de tarefas (concluída, atrasada, não concluída)', () => {
    const foto = montarFoto(
      [],
      [
        tarefa({ id: 'c', titulo: 'No prazo', concluida: true }),
        tarefa({ id: 'a', titulo: 'Atrasada', concluida: true, atrasada: true }),
        tarefa({ id: 'n', titulo: 'Aberta' }),
      ],
      INICIO,
      FIM,
      'Pizza',
    )

    expect(foto).toMatchObject({ total: 45, feitos: 18, bonus: false, recompensa: 'Pizza' })
    const situacoes = Object.fromEntries(foto.detalhe.tarefas.map((t) => [t.id, [t.situacao, t.pontos, t.pontosGanhos]]))
    expect(situacoes).toEqual({ c: ['CONCLUIDA', 15, 15], a: ['ATRASADA', 15, 3], n: ['NAO_CONCLUIDA', 15, 0] })
  })

  it('ordena por dia, hora (sem hora por último) e título; ignora Super task, fim de semana e fora do sprint', () => {
    const foto = montarFoto(
      [],
      [
        tarefa({ id: 'sem-hora', dia: '2026-11-17', hora: null, titulo: 'A' }),
        tarefa({ id: 'tarde', dia: '2026-11-17', hora: '15:00', titulo: 'B' }),
        tarefa({ id: 'cedo', dia: '2026-11-17', hora: '08:00', titulo: 'C' }),
        tarefa({ id: 'antes', dia: '2026-11-16', titulo: 'Z' }),
        tarefa({ id: 'sabado', dia: '2026-11-21' }),
        tarefa({ id: 'fora', dia: '2026-11-25' }),
        tarefa({ id: 'super', superTask: true }),
      ],
      INICIO,
      FIM,
      null,
    )

    expect(foto.detalhe.tarefas.map((t) => t.id)).toEqual(['antes', 'cedo', 'tarde', 'sem-hora'])
    expect(foto.recompensa).toBeNull()
  })

  it('rotina por dia útil: cumprido só com todas as ocorrências concluídas; lembretes ficam de fora', () => {
    const foto = montarFoto(
      [
        ocorrencia('2026-11-17', true, { nome: 'Remédio', ordem: 0 }),
        ocorrencia('2026-11-17', false, { nome: 'Academia', ordem: 1, hora: null }),
        ocorrencia('2026-11-16', true),
        ocorrencia('2026-11-21', true),
        ocorrencia('2026-11-18', false, { lembrete: true }),
      ],
      [],
      INICIO,
      FIM,
      null,
    )

    expect(foto.rotina).toMatchObject({ diasComRotina: 2, diasCumpridos: 1 })
    expect(foto.detalhe.rotina).toEqual([
      { data: '2026-11-16', cumprido: true, itens: [{ nome: 'Remédio', hora: '08:00', concluida: true }] },
      {
        data: '2026-11-17',
        cumprido: false,
        itens: [
          { nome: 'Remédio', hora: '08:00', concluida: true },
          { nome: 'Academia', hora: null, concluida: false },
        ],
      },
    ])
  })
})
