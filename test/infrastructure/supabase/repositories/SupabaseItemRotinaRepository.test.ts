import { describe, expect, it } from 'vitest'

import type { ItemRotinaPayload } from '../../../../src/domain/entities/ItemRotina'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabaseItemRotinaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseItemRotinaRepository'
import { USER_ID, linhaItemRotina } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok } from '../../../helpers/supabaseFake'

const ID = '123e4567-e89b-12d3-a456-426614174000'
const ERRO = { message: 'falha no banco' }
const POR_DIAS: ItemRotinaPayload = {
  nome: 'Tomar remédio',
  repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 3, 5] },
  vezes: [{ hora: '08:00' }, { hora: null }],
}
const POR_INTERVALO: ItemRotinaPayload = {
  nome: 'Regar',
  repeticao: { modo: 'A_CADA_N_DIAS', intervalo: 3, dataInicial: '2026-11-16' },
  vezes: [{ hora: null }],
}
const ITEM = { id: 'rot-1', areaId: 'area-rotina', ...POR_DIAS, criadoEm: '2026-01-01T00:00:00.000Z' }

function montar(respostas: Parameters<typeof criarSupabaseFake>[0]) {
  const fake = criarSupabaseFake(respostas)
  return { fake, repositorio: new SupabaseItemRotinaRepository(fake.client) }
}

describe('SupabaseItemRotinaRepository', () => {
  it('listar: filtra pelo usuário, ordena por nome e mapeia os dois modos', async () => {
    const { fake, repositorio } = montar({
      itens_rotina: [
        ok([
          linhaItemRotina(),
          linhaItemRotina({
            id: 'rot-2',
            modo: 'A_CADA_N_DIAS',
            dias_semana: null,
            intervalo_dias: 3,
            data_inicial: '2026-11-16',
            vezes: [{ hora: null }],
          }),
        ]),
      ],
    })

    const itens = await repositorio.listar(USER_ID)

    expect(itens).toEqual([ITEM, { ...ITEM, id: 'rot-2', repeticao: POR_INTERVALO.repeticao, vezes: [{ hora: null }] }])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['order', 'nome', { ascending: true }])
  })

  it('listar: dias_semana nulo num item por dias vira lista vazia; propaga erro', async () => {
    const { repositorio } = montar({ itens_rotina: [ok([linhaItemRotina({ dias_semana: null })]), falha(ERRO)] })

    await expect(repositorio.listar(USER_ID)).resolves.toMatchObject([{ repeticao: { dias: [] } }])
    await expect(repositorio.listar(USER_ID)).rejects.toBe(ERRO)
  })

  it('buscarPorId: devolve o item ou null, sempre filtrando por user_id', async () => {
    const { fake, repositorio } = montar({ itens_rotina: [ok(linhaItemRotina()), ok(null), falha(ERRO)] })

    await expect(repositorio.buscarPorId(USER_ID, ID)).resolves.toEqual(ITEM)
    await expect(repositorio.buscarPorId(USER_ID, ID)).resolves.toBeNull()
    await expect(repositorio.buscarPorId(USER_ID, ID)).rejects.toBe(ERRO)
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('criar: grava o modo por dias, zerando as colunas do outro modo', async () => {
    const { fake, repositorio } = montar({ itens_rotina: [ok(linhaItemRotina())] })

    await expect(repositorio.criar(USER_ID, 'area-rotina', POR_DIAS)).resolves.toEqual(ITEM)
    expect(argumentos(fake.consultas[0]!, 'insert')).toEqual([
      {
        nome: 'Tomar remédio',
        modo: 'DIAS_DA_SEMANA',
        dias_semana: [1, 3, 5],
        intervalo_dias: null,
        data_inicial: null,
        vezes: [{ hora: '08:00' }, { hora: null }],
        area_id: 'area-rotina',
        user_id: USER_ID,
      },
    ])
  })

  it('criar: grava o modo a cada N dias, zerando dias_semana; propaga erro', async () => {
    const { fake, repositorio } = montar({ itens_rotina: [ok(linhaItemRotina()), falha(ERRO)] })

    await repositorio.criar(USER_ID, 'area-rotina', POR_INTERVALO)
    expect(argumentos(fake.consultas[0]!, 'insert')![0]).toMatchObject({
      modo: 'A_CADA_N_DIAS',
      dias_semana: null,
      intervalo_dias: 3,
      data_inicial: '2026-11-16',
    })
    await expect(repositorio.criar(USER_ID, 'area-rotina', POR_INTERVALO)).rejects.toBe(ERRO)
  })

  it('atualizar: filtra por id e user_id, sem mexer na área', async () => {
    const { fake, repositorio } = montar({ itens_rotina: [ok(linhaItemRotina())] })

    await expect(repositorio.atualizar(USER_ID, ID, POR_DIAS)).resolves.toEqual(ITEM)
    const consulta = fake.consultas[0]!
    expect(argumentos(consulta, 'update')![0]).not.toHaveProperty('area_id')
    expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
    expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('atualizar: NotFoundError sem linha alterada; propaga erro', async () => {
    const { repositorio } = montar({ itens_rotina: [ok(null), falha(ERRO)] })

    await expect(repositorio.atualizar(USER_ID, ID, POR_DIAS)).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.atualizar(USER_ID, ID, POR_DIAS)).rejects.toBe(ERRO)
  })

  it('remover: filtra por id e user_id; NotFoundError sem linha; propaga erro', async () => {
    const { fake, repositorio } = montar({ itens_rotina: [ok([{ id: ID }]), ok([]), falha(ERRO)] })

    await expect(repositorio.remover(USER_ID, ID)).resolves.toBeUndefined()
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    await expect(repositorio.remover(USER_ID, ID)).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.remover(USER_ID, ID)).rejects.toBe(ERRO)
  })
})
