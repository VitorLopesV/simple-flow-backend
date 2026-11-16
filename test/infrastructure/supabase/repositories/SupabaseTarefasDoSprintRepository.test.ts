import { describe, expect, it } from 'vitest'

import { SupabaseTarefasDoSprintRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository'
import { USER_ID, linhaTarefa } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok } from '../../../helpers/supabaseFake'

const ERRO = { message: 'falha no banco' }

describe('SupabaseTarefasDoSprintRepository', () => {
  it('lê só as tarefas do sprint, filtrando por user_id e pela janela do sprint', async () => {
    const fake = criarSupabaseFake({
      tarefas: [
        ok([
          linhaTarefa({
            id: 't1',
            dia: '2026-11-18',
            tempo_estimado_minutos: 60,
            dificuldade: 'DIFICIL',
            prioridade: 'ALTA',
            sprint_id: 's1',
          }),
        ]),
      ],
    })

    const tarefas = await new SupabaseTarefasDoSprintRepository(fake.client).listar(USER_ID, 's1', '2026-11-16', '2026-11-20')

    expect(tarefas).toEqual([
      {
        id: 't1',
        dia: '2026-11-18',
        tempoEstimado: 60,
        dificuldade: 'DIFICIL',
        prioridade: 'ALTA',
        concluida: false,
        atrasada: false,
        superTask: false,
      },
    ])
    const consulta = fake.consultas[0]!
    expect(consulta.tabela).toBe('tarefas')
    expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(consulta.chamadas).toContainEqual(['eq', 'sprint_id', 's1'])
    expect(consulta.chamadas).toContainEqual(['gte', 'dia', '2026-11-16'])
    expect(consulta.chamadas).toContainEqual(['lte', 'dia', '2026-11-20'])
    expect(consulta.chamadas).toContainEqual(['is', 'arquivada_em', null])
    expect(argumentos(consulta, 'select')![0]).toContain('tempo_estimado_minutos')
  })

  it('ignora linhas sem dia ou sem algum campo de pontuação', async () => {
    const completa = { dia: '2026-11-18', tempo_estimado_minutos: 30, dificuldade: 'FACIL', prioridade: 'BAIXA' }
    const fake = criarSupabaseFake({
      tarefas: [
        ok([
          linhaTarefa({ ...completa, id: 'ok' }),
          linhaTarefa({ ...completa, id: 'a', dia: null }),
          linhaTarefa({ ...completa, id: 'b', tempo_estimado_minutos: null }),
          linhaTarefa({ ...completa, id: 'c', dificuldade: null }),
          linhaTarefa({ ...completa, id: 'd', prioridade: null }),
        ]),
      ],
    })

    const tarefas = await new SupabaseTarefasDoSprintRepository(fake.client).listar(USER_ID, 's1', '2026-11-16', '2026-11-20')
    expect(tarefas.map((t) => t.id)).toEqual(['ok'])
  })

  it('propaga o erro do banco', async () => {
    const fake = criarSupabaseFake({ tarefas: [falha(ERRO)] })
    await expect(new SupabaseTarefasDoSprintRepository(fake.client).listar(USER_ID, 's1', '2026-11-16', '2026-11-20')).rejects.toBe(ERRO)
  })
})
