import { describe, expect, it } from 'vitest'

import { SupabaseTarefasDoSprintRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository'
import { USER_ID } from '../../../helpers/linhasSupabase'
import { criarSupabaseFake } from '../../../helpers/supabaseFake'

describe('SupabaseTarefasDoSprintRepository', () => {
  it('por enquanto (antes da #69/#70) nenhuma tarefa está no sprint', async () => {
    const fake = criarSupabaseFake({})
    expect(await new SupabaseTarefasDoSprintRepository(fake.client).listar(USER_ID, 's1', '2026-11-16', '2026-11-20')).toEqual([])
  })
})
