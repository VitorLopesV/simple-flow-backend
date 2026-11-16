import { describe, expect, it } from 'vitest'

import { NotFoundError } from '../../../../src/domain/errors/DomainError'
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

  it('buscarPorId: filtra por id e user_id; nulo quando não existe; propaga erro', async () => {
    const fake = criarSupabaseFake({ ocorrencias_rotina: [ok(linhaOcorrenciaRotina()), ok(null), falha(ERRO)] })
    const repositorio = new SupabaseOcorrenciaRotinaRepository(fake.client)

    await expect(repositorio.buscarPorId(USER_ID, 'oco-1')).resolves.toMatchObject({ id: 'oco-1', concluidaEm: null })
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'id', 'oco-1'])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    await expect(repositorio.buscarPorId(USER_ID, 'x')).resolves.toBeNull()
    await expect(repositorio.buscarPorId(USER_ID, 'x')).rejects.toBe(ERRO)
  })

  it('concluir: só preenche se ainda não concluída, filtrando por id e user_id', async () => {
    const fake = criarSupabaseFake({
      ocorrencias_rotina: [ok(linhaOcorrenciaRotina({ concluida_em: '2026-11-16T15:00:00.000Z' }))],
    })

    await expect(
      new SupabaseOcorrenciaRotinaRepository(fake.client).concluir(USER_ID, 'oco-1', '2026-11-16T15:00:00.000Z'),
    ).resolves.toMatchObject({ concluidaEm: '2026-11-16T15:00:00.000Z' })
    const chamadas = fake.consultas[0]!.chamadas
    expect(chamadas).toContainEqual(['update', { concluida_em: '2026-11-16T15:00:00.000Z' }])
    expect(chamadas).toContainEqual(['eq', 'id', 'oco-1'])
    expect(chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(chamadas).toContainEqual(['is', 'concluida_em', null])
  })

  it('concluir: já concluída por outra requisição devolve a original; sumiu = NotFoundError; propaga erro', async () => {
    const fake = criarSupabaseFake({
      ocorrencias_rotina: [
        ok(null),
        ok(linhaOcorrenciaRotina({ concluida_em: '2026-11-16T14:00:00.000Z' })),
        ok(null),
        ok(null),
        falha(ERRO),
      ],
    })
    const repositorio = new SupabaseOcorrenciaRotinaRepository(fake.client)

    await expect(repositorio.concluir(USER_ID, 'oco-1', '2026-11-16T15:00:00.000Z')).resolves.toMatchObject({
      concluidaEm: '2026-11-16T14:00:00.000Z',
    })
    await expect(repositorio.concluir(USER_ID, 'oco-1', '2026-11-16T15:00:00.000Z')).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.concluir(USER_ID, 'oco-1', '2026-11-16T15:00:00.000Z')).rejects.toBe(ERRO)
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
