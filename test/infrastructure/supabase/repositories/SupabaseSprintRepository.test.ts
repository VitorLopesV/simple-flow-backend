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
  recompensa: null,
  fechadoEm: null,
  foto: null,
  fechamentoAplicadoEm: null,
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

  it('mapeia a foto e o fechamento do sprint fechado', async () => {
    const foto = { total: 300, feitos: 240, percentual: 80, bonus: false }
    const fake = criarSupabaseFake({
      sprints: [
        ok(null),
        ok(linhaSprint({ situacao: 'FECHADO', foto, fechado_em: '2026-11-21T02:59:00.000Z', fechamento_aplicado_em: '2026-11-21T02:59:00.000Z' })),
      ],
    })

    const sprint = await new SupabaseSprintRepository(fake.client).garantir(USER_ID, '2026-11-16', '2026-11-20')

    expect(sprint).toMatchObject({
      situacao: 'FECHADO',
      foto,
      fechadoEm: '2026-11-21T02:59:00.000Z',
      fechamentoAplicadoEm: '2026-11-21T02:59:00.000Z',
    })
  })

  it('listarPendentesDeFechamento: só do usuário, com fim até a data e fechamento não aplicado, do mais antigo ao mais novo', async () => {
    const fake = criarSupabaseFake({ sprints: [ok([linhaSprint({ id: 'a' }), linhaSprint({ id: 'b' })]), falha(ERRO)] })
    const repositorio = new SupabaseSprintRepository(fake.client)

    const pendentes = await repositorio.listarPendentesDeFechamento(USER_ID, '2026-11-21')
    await expect(repositorio.listarPendentesDeFechamento(USER_ID, 'x')).rejects.toBe(ERRO)

    expect(pendentes.map((s) => s.id)).toEqual(['a', 'b'])
    const chamadas = fake.consultas[0]!.chamadas
    expect(chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(chamadas).toContainEqual(['lte', 'fim', '2026-11-21'])
    expect(chamadas).toContainEqual(['is', 'fechamento_aplicado_em', null])
    expect(chamadas).toContainEqual(['order', 'inicio', { ascending: true }])
  })

  it('fechar: grava a foto só em sprint ABERTO do usuário; devolve se esta chamada fechou; propaga erro', async () => {
    const foto = { total: 0, feitos: 0, percentual: 0, bonus: false, rotina: {}, tarefas: {} } as never
    const fake = criarSupabaseFake({ sprints: [ok([{ id: 'spr-1' }]), ok([]), falha(ERRO)] })
    const repositorio = new SupabaseSprintRepository(fake.client)

    expect(await repositorio.fechar(USER_ID, 'spr-1', foto, '2026-11-21T02:59:00.000Z')).toBe(true)
    expect(await repositorio.fechar(USER_ID, 'spr-1', foto, 'x')).toBe(false)
    await expect(repositorio.fechar(USER_ID, 'spr-1', foto, 'x')).rejects.toBe(ERRO)

    const chamadas = fake.consultas[0]!.chamadas
    expect(chamadas).toContainEqual(['update', { situacao: 'FECHADO', foto, fechado_em: '2026-11-21T02:59:00.000Z' }])
    expect(chamadas).toContainEqual(['eq', 'id', 'spr-1'])
    expect(chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(chamadas).toContainEqual(['eq', 'situacao', 'ABERTO'])
  })

  it('marcarFechamentoAplicado: só do usuário e só se ainda não aplicado; propaga erro', async () => {
    const fake = criarSupabaseFake({ sprints: [ok(null), falha(ERRO)] })
    const repositorio = new SupabaseSprintRepository(fake.client)

    await repositorio.marcarFechamentoAplicado(USER_ID, 'spr-1', '2026-11-21T02:59:00.000Z')
    await expect(repositorio.marcarFechamentoAplicado(USER_ID, 'spr-1', 'x')).rejects.toBe(ERRO)

    const chamadas = fake.consultas[0]!.chamadas
    expect(chamadas).toContainEqual(['update', { fechamento_aplicado_em: '2026-11-21T02:59:00.000Z' }])
    expect(chamadas).toContainEqual(['eq', 'id', 'spr-1'])
    expect(chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(chamadas).toContainEqual(['is', 'fechamento_aplicado_em', null])
  })

  it('definirRecompensa: só em sprint ABERTO do usuário; false se já estava fechado; propaga erro', async () => {
    const fake = criarSupabaseFake({ sprints: [ok([{ id: 'spr-1' }]), ok([]), falha(ERRO)] })
    const repositorio = new SupabaseSprintRepository(fake.client)

    expect(await repositorio.definirRecompensa(USER_ID, 'spr-1', 'Pizza')).toBe(true)
    expect(await repositorio.definirRecompensa(USER_ID, 'spr-1', null)).toBe(false)
    await expect(repositorio.definirRecompensa(USER_ID, 'spr-1', 'x')).rejects.toBe(ERRO)

    const chamadas = fake.consultas[0]!.chamadas
    expect(chamadas).toContainEqual(['update', { recompensa: 'Pizza' }])
    expect(chamadas).toContainEqual(['eq', 'id', 'spr-1'])
    expect(chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(chamadas).toContainEqual(['eq', 'situacao', 'ABERTO'])
  })

  it('listarFechados: só FECHADOS com foto do usuário, mais recente primeiro, paginado, com o total', async () => {
    const fake = criarSupabaseFake({
      sprints: [{ data: [linhaSprint({ id: 'a', situacao: 'FECHADO' })], error: null, count: 23 } as never, falha(ERRO)],
    })
    const repositorio = new SupabaseSprintRepository(fake.client)

    const pagina = await repositorio.listarFechados(USER_ID, 3, 10)
    await expect(repositorio.listarFechados(USER_ID, 1, 10)).rejects.toBe(ERRO)

    expect(pagina.total).toBe(23)
    expect(pagina.sprints.map((s) => s.id)).toEqual(['a'])
    const chamadas = fake.consultas[0]!.chamadas
    expect(chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(chamadas).toContainEqual(['eq', 'situacao', 'FECHADO'])
    expect(chamadas).toContainEqual(['not', 'foto', 'is', null])
    expect(chamadas).toContainEqual(['order', 'inicio', { ascending: false }])
    expect(chamadas).toContainEqual(['range', 20, 29])
  })
})
