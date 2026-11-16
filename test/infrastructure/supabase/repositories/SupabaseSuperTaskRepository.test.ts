import { describe, expect, it } from 'vitest'

import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabaseSuperTaskRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseSuperTaskRepository'
import { USER_ID, linhaSuperTask } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok, usou } from '../../../helpers/supabaseFake'

const ID = '123e4567-e89b-12d3-a456-426614174000'
const ID_2 = '123e4567-e89b-12d3-a456-426614174001'
const ERRO = { message: 'falha no banco' }
const SUPER = {
  id: 'st-1',
  areaId: 'area-1',
  titulo: 'Pintar a casa',
  notas: null,
  dataTermino: null,
  concluidaEm: null,
  concluida: false,
  arquivada: false,
  arquivadaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}
const EDICAO = { titulo: 'TCC', notas: 'n', dataTermino: '2026-12-20' }

function montar(respostas: Parameters<typeof criarSupabaseFake>[0]) {
  const fake = criarSupabaseFake(respostas)
  return { fake, repositorio: new SupabaseSuperTaskRepository(fake.client) }
}

describe('SupabaseSuperTaskRepository', () => {
  it('listar: filtra pelo usuário, oculta arquivadas por padrão e ordena pelas mais recentes', async () => {
    const { fake, repositorio } = montar({ super_tasks: [ok([linhaSuperTask()])] })

    await expect(repositorio.listar(USER_ID, { incluirArquivadas: false })).resolves.toEqual([SUPER])
    const consulta = fake.consultas[0]!
    expect(consulta.tabela).toBe('super_tasks')
    expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(consulta.chamadas).toContainEqual(['is', 'arquivada_em', null])
    expect(consulta.chamadas).toContainEqual(['order', 'criado_em', { ascending: false }])
    expect(consulta.chamadas.some(([n, c]) => n === 'eq' && c === 'area_id')).toBe(false)
  })

  it('listar: filtra por área, inclui arquivadas e mapeia conclusão e arquivamento', async () => {
    const { fake, repositorio } = montar({
      super_tasks: [
        ok([linhaSuperTask({ concluida_em: '2026-02-01T00:00:00.000Z', arquivada_em: '2026-03-01T00:00:00.000Z', data_termino: '2026-12-01' })]),
        falha(ERRO),
      ],
    })

    const [superTask] = await repositorio.listar(USER_ID, { areaId: ID, incluirArquivadas: true })

    expect(superTask).toMatchObject({
      concluida: true,
      concluidaEm: '2026-02-01T00:00:00.000Z',
      arquivada: true,
      arquivadaEm: '2026-03-01T00:00:00.000Z',
      dataTermino: '2026-12-01',
    })
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'area_id', ID])
    expect(usou(fake.consultas[0]!, 'is')).toBe(false)
    await expect(repositorio.listar(USER_ID, { incluirArquivadas: false })).rejects.toBe(ERRO)
  })

  it('buscarPorId: devolve a Super task ou null, sempre filtrando por user_id; propaga erro', async () => {
    const { fake, repositorio } = montar({ super_tasks: [ok(linhaSuperTask()), ok(null), falha(ERRO)] })

    await expect(repositorio.buscarPorId(USER_ID, ID)).resolves.toEqual(SUPER)
    await expect(repositorio.buscarPorId(USER_ID, ID)).resolves.toBeNull()
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    await expect(repositorio.buscarPorId(USER_ID, ID)).rejects.toBe(ERRO)
  })

  it('criar: insere com user_id e area_id; propaga erro', async () => {
    const { fake, repositorio } = montar({ super_tasks: [ok(linhaSuperTask()), falha(ERRO)] })

    await expect(repositorio.criar(USER_ID, { ...EDICAO, areaId: ID })).resolves.toEqual(SUPER)
    expect(argumentos(fake.consultas[0]!, 'insert')).toEqual([
      { titulo: 'TCC', notas: 'n', data_termino: '2026-12-20', area_id: ID, user_id: USER_ID },
    ])
    await expect(repositorio.criar(USER_ID, { ...EDICAO, areaId: ID })).rejects.toBe(ERRO)
  })

  it('atualizar: grava só os campos editáveis, filtrando por id e user_id', async () => {
    const { fake, repositorio } = montar({ super_tasks: [ok(linhaSuperTask({ titulo: 'TCC' })), ok(null), falha(ERRO)] })

    await expect(repositorio.atualizar(USER_ID, ID, EDICAO)).resolves.toMatchObject({ titulo: 'TCC' })
    expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ titulo: 'TCC', notas: 'n', data_termino: '2026-12-20' }])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'id', ID])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    await expect(repositorio.atualizar(USER_ID, ID, EDICAO)).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.atualizar(USER_ID, ID, EDICAO)).rejects.toBe(ERRO)
  })

  it('mover: troca só o area_id', async () => {
    const { fake, repositorio } = montar({ super_tasks: [ok(linhaSuperTask({ area_id: ID_2 }))] })

    await expect(repositorio.mover(USER_ID, ID, ID_2)).resolves.toMatchObject({ areaId: ID_2 })
    expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ area_id: ID_2 }])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('definirConclusao: grava o instante ou null (reabre)', async () => {
    const { fake, repositorio } = montar({ super_tasks: [ok(linhaSuperTask()), ok(linhaSuperTask())] })

    await repositorio.definirConclusao(USER_ID, ID, '2026-03-01T10:00:00.000Z')
    await repositorio.definirConclusao(USER_ID, ID, null)

    expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ concluida_em: '2026-03-01T10:00:00.000Z' }])
    expect(argumentos(fake.consultas[1]!, 'update')).toEqual([{ concluida_em: null }])
    expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('definirArquivamento: grava a data ou null', async () => {
    const { fake, repositorio } = montar({ super_tasks: [ok(linhaSuperTask()), ok(linhaSuperTask())] })

    await repositorio.definirArquivamento(USER_ID, ID, '2026-03-01T10:00:00.000Z')
    await repositorio.definirArquivamento(USER_ID, ID, null)

    expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ arquivada_em: '2026-03-01T10:00:00.000Z' }])
    expect(argumentos(fake.consultas[1]!, 'update')).toEqual([{ arquivada_em: null }])
  })

  it('remover: apaga filtrando por id e user_id; NotFoundError sem linhas; propaga erro', async () => {
    const { fake, repositorio } = montar({ super_tasks: [ok([{ id: ID }]), ok([]), falha(ERRO)] })

    await expect(repositorio.remover(USER_ID, ID)).resolves.toBeUndefined()
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    await expect(repositorio.remover(USER_ID, ID)).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.remover(USER_ID, ID)).rejects.toBe(ERRO)
  })
})
