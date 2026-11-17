import { describe, expect, it, vi } from 'vitest'

import { ObterPlacarDoSprint } from '../../../../src/application/use-cases/sprints/ObterPlacarDoSprint'

describe('ObterPlacarDoSprint', () => {
  it('monta o placar com as ocorrências do sprint e as tarefas do repositório', async () => {
    const agora = new Date('2026-11-17T15:00:00Z')
    const obterSprint = {
      execute: vi.fn().mockResolvedValue({
        sprint: { id: 's1', inicio: '2026-11-16', fim: '2026-11-20' },
        iniciado: true,
        previa: false,
        ocorrencias: [{ data: '2026-11-16', concluidaEm: '2026-11-16T12:00:00Z' }],
        lembretes: [],
      }),
    }
    const tarefas = {
      listar: vi.fn().mockResolvedValue([
        {
          id: 't',
          dia: '2026-11-17',
          tempoEstimado: 60,
          dificuldade: 'DIFICIL',
          prioridade: 'ALTA',
          concluida: false,
          atrasada: false,
          superTask: false,
        },
      ]),
      devolverNaoConcluidas: vi.fn(),
    }

    const resultado = await new ObterPlacarDoSprint(obterSprint, tarefas).execute('u1', 'ATUAL', agora)

    expect(obterSprint.execute).toHaveBeenCalledWith('u1', 'ATUAL', agora)
    expect(tarefas.listar).toHaveBeenCalledWith('u1', 's1', '2026-11-16', '2026-11-20')
    expect(resultado).toMatchObject({ sprintId: 's1', inicio: '2026-11-16', fim: '2026-11-20', iniciado: true, previa: false })
    expect(resultado.placar).toMatchObject({ total: 55, feitos: 40, percentual: 72.7, bonus: false })
  })
})
