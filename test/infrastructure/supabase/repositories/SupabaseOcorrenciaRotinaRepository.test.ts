import { describe, expect, it } from 'vitest'

import { SupabaseOcorrenciaRotinaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository'
import { USER_ID, linhaOcorrenciaRotina } from '../../../helpers/linhasSupabase'
import { criarSupabaseFake, falha, ok } from '../../../helpers/supabaseFake'

const ERRO = { message: 'falha no banco' }
const PLANEJADA = { itemId: 'rot-1', nome: 'Tomar remédio', data: '2026-11-16', hora: '08:00', indice: 0, ordem: 0 }

describe('SupabaseOcorrenciaRotinaRepository', () => {
  it('listarDoSprint: filtra por sprint e usuário, ordena e mapeia', async () => {
    const fake = criarSupabaseFake({
      ocorrencias_rotina: [ok([linhaOcorrenciaRotina(), linhaOcorrenciaRotina({ id: 'oco-2', lembrete: true, item_id: null })]), falha(ERRO)],
    })
    const repositorio = new SupabaseOcorrenciaRotinaRepository(fake.client)

    const lista = await repositorio.listarDoSprint(USER_ID, 'spr-1')

    expect(lista).toEqual([
      { ...PLANEJADA, id: 'oco-1', sprintId: 'spr-1', lembrete: false, concluidaEm: null },
      { ...PLANEJADA, id: 'oco-2', sprintId: 'spr-1', itemId: null, lembrete: true, concluidaEm: null },
    ])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'sprint_id', 'spr-1'])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['order', 'ordem', { ascending: true }])
    await expect(repositorio.listarDoSprint(USER_ID, 'spr-1')).rejects.toBe(ERRO)
  })

  it('inserirVarias: upsert que ignora duplicata, com user_id e marcação de lembrete', async () => {
    const fake = criarSupabaseFake({ ocorrencias_rotina: [ok(null), falha(ERRO)] })
    const repositorio = new SupabaseOcorrenciaRotinaRepository(fake.client)
    const lembrete = { ...PLANEJADA, data: '2026-11-22', hora: null }

    await repositorio.inserirVarias(USER_ID, 'spr-1', [PLANEJADA], [lembrete])
    await expect(repositorio.inserirVarias(USER_ID, 'spr-1', [PLANEJADA], [])).rejects.toBe(ERRO)

    expect(fake.consultas[0]!.chamadas).toContainEqual([
      'upsert',
      [
        { user_id: USER_ID, sprint_id: 'spr-1', item_id: 'rot-1', nome: 'Tomar remédio', data: '2026-11-16', hora: '08:00', indice: 0, ordem: 0, lembrete: false },
        { user_id: USER_ID, sprint_id: 'spr-1', item_id: 'rot-1', nome: 'Tomar remédio', data: '2026-11-22', hora: null, indice: 0, ordem: 0, lembrete: true },
      ],
      { onConflict: 'sprint_id,item_id,data,indice', ignoreDuplicates: true },
    ])
  })

  it('inserirVarias: sem nada a gravar, não consulta o banco', async () => {
    const fake = criarSupabaseFake()
    await new SupabaseOcorrenciaRotinaRepository(fake.client).inserirVarias(USER_ID, 'spr-1', [], [])
    expect(fake.consultas).toHaveLength(0)
  })
})
