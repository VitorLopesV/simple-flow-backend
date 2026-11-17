import { describe, expect, it } from 'vitest'

import { SupabaseTarefaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseTarefaRepository'
import { USER_ID, linhaTarefa } from '../../../helpers/linhasSupabase'
import { criarSupabaseFake, falha, ok } from '../../../helpers/supabaseFake'

describe('SupabaseTarefaRepository.listarDoDia', () => {
  it('filtra por user_id, dia e não arquivadas, e mapeia (hora HH:MM, atraso da conclusão)', async () => {
    const fake = criarSupabaseFake({
      tarefas: [
        ok([
          linhaTarefa({ dia: '2026-11-16', hora: '09:00:00', tempo_estimado_minutos: 60, concluida_em: '2026-11-16T14:00:00Z' }),
        ]),
      ],
    })

    const [tarefa] = await new SupabaseTarefaRepository(fake.client).listarDoDia(USER_ID, '2026-11-16')

    expect(fake.consultasDe('tarefas')[0]!.chamadas).toEqual([
      ['select', '*'],
      ['eq', 'user_id', USER_ID],
      ['eq', 'dia', '2026-11-16'],
      ['is', 'arquivada_em', null],
    ])
    expect(tarefa).toMatchObject({ hora: '09:00', concluida: true, atrasada: true })
  })

  it('propaga o erro do banco', async () => {
    const fake = criarSupabaseFake({ tarefas: [falha({ message: 'falha' })] })

    await expect(new SupabaseTarefaRepository(fake.client).listarDoDia(USER_ID, '2026-11-16')).rejects.toEqual({
      message: 'falha',
    })
  })
})
