import { describe, expect, it } from 'vitest'

import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabaseTarefaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseTarefaRepository'
import { USER_ID, linhaTarefa } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok, usou } from '../../../helpers/supabaseFake'

const ID = '123e4567-e89b-12d3-a456-426614174000'
const ID_2 = '123e4567-e89b-12d3-a456-426614174001'
const ERRO = { message: 'falha no banco' }
const TAREFA = {
  id: 'tar-1',
  areaId: 'area-1',
  titulo: 'Pintar a casa',
  dia: null,
  hora: null,
  tempoEstimado: null,
  dificuldade: null,
  prioridade: null,
  notas: null,
  sprintId: null,
  concluidaEm: null,
  concluida: false,
  atrasada: false,
  arquivada: false,
  arquivadaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}
const EDICAO = {
  titulo: 'Estudar',
  dia: '2026-12-01',
  hora: '08:30',
  tempoEstimado: 60 as const,
  dificuldade: 'MEDIA' as const,
  prioridade: 'ALTA' as const,
  notas: 'n',
}

function montar(respostas: Parameters<typeof criarSupabaseFake>[0]) {
  const fake = criarSupabaseFake(respostas)
  return { fake, repositorio: new SupabaseTarefaRepository(fake.client) }
}

describe('SupabaseTarefaRepository', () => {
  it('listar: filtra pelo usuário, oculta arquivadas por padrão e ordena pelas mais recentes', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok([linhaTarefa()])] })

    await expect(repositorio.listar(USER_ID, { incluirArquivadas: false })).resolves.toEqual([TAREFA])
    const consulta = fake.consultas[0]!
    expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(consulta.chamadas).toContainEqual(['is', 'arquivada_em', null])
    expect(consulta.chamadas).toContainEqual(['order', 'criado_em', { ascending: false }])
    expect(argumentos(consulta, 'eq')).toEqual(['user_id', USER_ID])
    expect(consulta.chamadas.some(([n, c]) => n === 'eq' && c === 'area_id')).toBe(false)
  })

  it('listar: filtra por área e inclui arquivadas quando pedido', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok([linhaTarefa({ arquivada_em: '2026-02-01T00:00:00.000Z' })])] })

    const [tarefa] = await repositorio.listar(USER_ID, { areaId: ID, incluirArquivadas: true })

    expect(tarefa).toMatchObject({ arquivada: true, arquivadaEm: '2026-02-01T00:00:00.000Z' })
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'area_id', ID])
    expect(usou(fake.consultas[0]!, 'is')).toBe(false)
  })

  it('listar: converte hora HH:MM:SS em HH:MM e propaga tempo, dificuldade e prioridade', async () => {
    const { repositorio } = montar({
      tarefas: [ok([linhaTarefa({ hora: '08:30:00', tempo_estimado_minutos: 60, dificuldade: 'FACIL', prioridade: 'BAIXA' })])],
    })

    await expect(repositorio.listar(USER_ID, { incluirArquivadas: false })).resolves.toMatchObject([
      { hora: '08:30', tempoEstimado: 60, dificuldade: 'FACIL', prioridade: 'BAIXA' },
    ])
  })

  it('listar: propaga o erro do banco', async () => {
    const { repositorio } = montar({ tarefas: [falha(ERRO)] })
    await expect(repositorio.listar(USER_ID, { incluirArquivadas: false })).rejects.toBe(ERRO)
  })

  it('buscarPorId: devolve a tarefa ou null, sempre filtrando por user_id', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok(linhaTarefa()), ok(null)] })

    await expect(repositorio.buscarPorId(USER_ID, ID)).resolves.toEqual(TAREFA)
    await expect(repositorio.buscarPorId(USER_ID, ID)).resolves.toBeNull()
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('buscarPorId: propaga o erro do banco', async () => {
    const { repositorio } = montar({ tarefas: [falha(ERRO)] })
    await expect(repositorio.buscarPorId(USER_ID, ID)).rejects.toBe(ERRO)
  })

  it('criar: grava em snake_case com o user_id e devolve a tarefa', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok(linhaTarefa())] })

    await expect(repositorio.criar(USER_ID, { ...EDICAO, areaId: ID })).resolves.toEqual(TAREFA)
    expect(argumentos(fake.consultas[0]!, 'insert')).toEqual([
      {
        titulo: 'Estudar',
        dia: '2026-12-01',
        hora: '08:30',
        tempo_estimado_minutos: 60,
        dificuldade: 'MEDIA',
        prioridade: 'ALTA',
        notas: 'n',
        area_id: ID,
        user_id: USER_ID,
        sprint_id: null,
      },
    ])
  })

  it('criar: grava o sprint quando a criação já entra nele', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok(linhaTarefa({ sprint_id: 'spr-1' }))] })

    await expect(repositorio.criar(USER_ID, { ...EDICAO, areaId: ID }, 'spr-1')).resolves.toEqual({ ...TAREFA, sprintId: 'spr-1' })
    expect(argumentos(fake.consultas[0]!, 'insert')![0]).toMatchObject({ sprint_id: 'spr-1', user_id: USER_ID })
  })

  it('atualizar: com sprintId grava o vínculo junto; null tira do sprint; omitido não mexe', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok(linhaTarefa()), ok(linhaTarefa()), ok(linhaTarefa())] })

    await repositorio.atualizar(USER_ID, ID, EDICAO, 'spr-1')
    await repositorio.atualizar(USER_ID, ID, EDICAO, null)
    await repositorio.atualizar(USER_ID, ID, EDICAO)

    expect(argumentos(fake.consultas[0]!, 'update')![0]).toMatchObject({ sprint_id: 'spr-1' })
    expect(argumentos(fake.consultas[1]!, 'update')![0]).toMatchObject({ sprint_id: null })
    expect(argumentos(fake.consultas[2]!, 'update')![0]).not.toHaveProperty('sprint_id')
  })

  it('definirSprint: entra com sprint e dia, sempre filtrando por id e user_id', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok(linhaTarefa({ sprint_id: 'spr-1', dia: '2026-11-18' }))] })

    await expect(repositorio.definirSprint(USER_ID, ID, { sprintId: 'spr-1', dia: '2026-11-18' })).resolves.toMatchObject({
      sprintId: 'spr-1',
      dia: '2026-11-18',
    })
    const consulta = fake.consultas[0]!
    expect(argumentos(consulta, 'update')).toEqual([{ sprint_id: 'spr-1', dia: '2026-11-18' }])
    expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
    expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('definirSprint: sair do sprint não mexe no dia', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok(linhaTarefa())] })

    await repositorio.definirSprint(USER_ID, ID, { sprintId: null })
    expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ sprint_id: null }])
  })

  it('concluir: só preenche se ainda não concluída, filtrando por id e user_id', async () => {
    const { fake, repositorio } = montar({
      tarefas: [ok(linhaTarefa({ concluida_em: '2026-11-18T15:00:00.000Z', dia: '2026-11-18' }))],
    })

    await expect(repositorio.concluir(USER_ID, ID, '2026-11-18T15:00:00.000Z')).resolves.toMatchObject({
      concluida: true,
      concluidaEm: '2026-11-18T15:00:00.000Z',
      atrasada: false,
    })
    const consulta = fake.consultas[0]!
    expect(argumentos(consulta, 'update')).toEqual([{ concluida_em: '2026-11-18T15:00:00.000Z' }])
    expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
    expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(consulta.chamadas).toContainEqual(['is', 'concluida_em', null])
  })

  it('concluir: se outra requisição já concluiu, devolve a conclusão original (user_id na releitura)', async () => {
    const original = linhaTarefa({ concluida_em: '2026-11-18T14:00:00.000Z' })
    const { fake, repositorio } = montar({ tarefas: [ok(null), ok(original)] })

    await expect(repositorio.concluir(USER_ID, ID, '2026-11-18T15:00:00.000Z')).resolves.toMatchObject({
      concluidaEm: '2026-11-18T14:00:00.000Z',
    })
    expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('concluir: NotFoundError se a tarefa sumiu; propaga erro do banco', async () => {
    const { repositorio } = montar({ tarefas: [ok(null), ok(null), falha(ERRO)] })

    await expect(repositorio.concluir(USER_ID, ID, '2026-11-18T15:00:00.000Z')).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.concluir(USER_ID, ID, '2026-11-18T15:00:00.000Z')).rejects.toBe(ERRO)
  })

  it('mapeia o atraso da tarefa concluída (com hora: depois de início + tempo; sem hora: depois do dia)', async () => {
    const { repositorio } = montar({
      tarefas: [
        ok([
          linhaTarefa({ id: 'a', dia: '2026-11-16', hora: '12:00:00', tempo_estimado_minutos: 15, concluida_em: '2026-11-16T15:30:00.000Z' }),
          linhaTarefa({ id: 'b', dia: '2026-11-16', hora: '12:00:00', tempo_estimado_minutos: 15, concluida_em: '2026-11-16T15:15:00.000Z' }),
          linhaTarefa({ id: 'c', dia: '2026-11-16', concluida_em: '2026-11-17T03:00:00.000Z' }),
          linhaTarefa({ id: 'd', dia: '2026-11-16', concluida_em: '2026-11-17T02:59:00.000Z' }),
          linhaTarefa({ id: 'e', dia: '2026-11-16' }),
        ]),
      ],
    })

    const lista = await repositorio.listar(USER_ID, { incluirArquivadas: false })
    expect(lista.map((t) => [t.id, t.concluida, t.atrasada])).toEqual([
      ['a', true, true],
      ['b', true, false],
      ['c', true, true],
      ['d', true, false],
      ['e', false, false],
    ])
  })

  it('criar: propaga o erro do banco', async () => {
    const { repositorio } = montar({ tarefas: [falha(ERRO)] })
    await expect(repositorio.criar(USER_ID, { ...EDICAO, areaId: ID })).rejects.toBe(ERRO)
  })

  it('atualizar: altera só os campos editáveis, filtrando por id e user_id', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok(linhaTarefa())] })

    await expect(repositorio.atualizar(USER_ID, ID, EDICAO)).resolves.toEqual(TAREFA)
    const consulta = fake.consultas[0]!
    expect(argumentos(consulta, 'update')![0]).not.toHaveProperty('area_id')
    expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
    expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('atualizar: NotFoundError quando nenhuma linha é alterada; propaga erro do banco', async () => {
    const { repositorio } = montar({ tarefas: [ok(null), falha(ERRO)] })

    await expect(repositorio.atualizar(USER_ID, ID, EDICAO)).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.atualizar(USER_ID, ID, EDICAO)).rejects.toBe(ERRO)
  })

  it('mover: troca só o area_id', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok(linhaTarefa({ area_id: ID_2 }))] })

    await expect(repositorio.mover(USER_ID, ID, ID_2)).resolves.toMatchObject({ areaId: ID_2 })
    expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ area_id: ID_2 }])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('definirArquivamento: grava a data ou null', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok(linhaTarefa()), ok(linhaTarefa())] })

    await repositorio.definirArquivamento(USER_ID, ID, '2026-03-01T10:00:00.000Z')
    await repositorio.definirArquivamento(USER_ID, ID, null)

    expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ arquivada_em: '2026-03-01T10:00:00.000Z' }])
    expect(argumentos(fake.consultas[1]!, 'update')).toEqual([{ arquivada_em: null }])
  })

  it('remover: apaga filtrando por id e user_id; NotFoundError sem linhas; propaga erro', async () => {
    const { fake, repositorio } = montar({ tarefas: [ok([{ id: ID }]), ok([]), falha(ERRO)] })

    await expect(repositorio.remover(USER_ID, ID)).resolves.toBeUndefined()
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    await expect(repositorio.remover(USER_ID, ID)).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.remover(USER_ID, ID)).rejects.toBe(ERRO)
  })
})
