import { describe, expect, it } from 'vitest'

import { SupabaseSprintRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseSprintRepository'
import { USER_ID, linhaSprint } from '../../../helpers/linhasSupabase'
import { criarSupabaseFake, falha, ok } from '../../../helpers/supabaseFake'

const ERRO = { message: 'falha no banco' }
const SPRINT = {
  id: 'spr-1',
  inicio: '2026-11-16',
  fim: '2026-11-20',
  situacao: 'ABERTO',
  rotinaGeradaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}

describe('SupabaseSprintRepository', () => {
  it('garantir: cria ignorando duplicata e lê o sprint do usuário na semana', async () => {
    const fake = criarSupabaseFake({ sprints: [ok(null), ok(linhaSprint())] })

    const sprint = await new SupabaseSprintRepository(fake.client).garantir(USER_ID, '2026-11-16', '2026-11-20')

    expect(sprint).toEqual(SPRINT)
    expect(fake.consultas[0]!.chamadas).toContainEqual([
      'upsert',
      { user_id: USER_ID, inicio: '2026-11-16', fim: '2026-11-20' },
      { onConflict: 'user_id,inicio', ignoreDuplicates: true },
    ])
    expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'inicio', '2026-11-16'])
  })

  it('garantir: propaga erro da criação e da leitura', async () => {
    const criacao = criarSupabaseFake({ sprints: [falha(ERRO)] })
    await expect(new SupabaseSprintRepository(criacao.client).garantir(USER_ID, 'a', 'b')).rejects.toBe(ERRO)

    const leitura = criarSupabaseFake({ sprints: [ok(null), falha(ERRO)] })
    await expect(new SupabaseSprintRepository(leitura.client).garantir(USER_ID, 'a', 'b')).rejects.toBe(ERRO)
  })

  it('marcarRotinaGerada: só atualiza sprint do usuário ainda não gerado; propaga erro', async () => {
    const fake = criarSupabaseFake({ sprints: [ok(null), falha(ERRO)] })
    const repositorio = new SupabaseSprintRepository(fake.client)

    await repositorio.marcarRotinaGerada(USER_ID, 'spr-1', '2026-11-18T15:00:00.000Z')
    await expect(repositorio.marcarRotinaGerada(USER_ID, 'spr-1', 'x')).rejects.toBe(ERRO)

    const chamadas = fake.consultas[0]!.chamadas
    expect(chamadas).toContainEqual(['update', { rotina_gerada_em: '2026-11-18T15:00:00.000Z' }])
    expect(chamadas).toContainEqual(['eq', 'id', 'spr-1'])
    expect(chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(chamadas).toContainEqual(['is', 'rotina_gerada_em', null])
  })
})
