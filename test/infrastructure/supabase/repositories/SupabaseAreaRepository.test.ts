import { describe, expect, it } from 'vitest'

import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabaseAreaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseAreaRepository'
import { USER_ID, linhaArea } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok, usou } from '../../../helpers/supabaseFake'

const ID = '123e4567-e89b-12d3-a456-426614174000'
const ID_2 = '123e4567-e89b-12d3-a456-426614174001'
const ERRO = { message: 'falha no banco' }
const AREA = { id: 'area-1', nome: 'Estudos', cor: '#10b981', sistema: false, criadoEm: '2026-01-01T00:00:00.000Z' }

function montar(respostas: Parameters<typeof criarSupabaseFake>[0]) {
  const fake = criarSupabaseFake(respostas)
  return { fake, repositorio: new SupabaseAreaRepository(fake.client) }
}

describe('SupabaseAreaRepository', () => {
  it('listar: filtra pelo usuário, sistema primeiro e por nome, mapeando para camelCase', async () => {
    const { fake, repositorio } = montar({ areas: [ok([linhaArea()])] })

    await expect(repositorio.listar(USER_ID)).resolves.toEqual([AREA])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['order', 'sistema', { ascending: false }])
  })

  it('listar: propaga o erro do banco', async () => {
    const { repositorio } = montar({ areas: [falha(ERRO)] })
    await expect(repositorio.listar(USER_ID)).rejects.toBe(ERRO)
  })

  it('buscarPorId: devolve a área ou null, sempre filtrando por user_id', async () => {
    const { fake, repositorio } = montar({ areas: [ok(linhaArea()), ok(null)] })

    await expect(repositorio.buscarPorId(USER_ID, ID)).resolves.toEqual(AREA)
    await expect(repositorio.buscarPorId(USER_ID, ID)).resolves.toBeNull()
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('buscarPorId: propaga o erro do banco', async () => {
    const { repositorio } = montar({ areas: [falha(ERRO)] })
    await expect(repositorio.buscarPorId(USER_ID, ID)).rejects.toBe(ERRO)
  })

  it('buscarPorNome: compara sem diferenciar maiúsculas e escapa curingas', async () => {
    const { fake, repositorio } = montar({ areas: [ok(linhaArea()), ok(null)] })

    await expect(repositorio.buscarPorNome(USER_ID, ' 100%_ ')).resolves.toEqual(AREA)
    await expect(repositorio.buscarPorNome(USER_ID, 'x')).resolves.toBeNull()
    expect(argumentos(fake.consultas[0]!, 'ilike')).toEqual(['nome', '100\\%\\_'])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('buscarPorNome: propaga o erro do banco', async () => {
    const { repositorio } = montar({ areas: [falha(ERRO)] })
    await expect(repositorio.buscarPorNome(USER_ID, 'x')).rejects.toBe(ERRO)
  })

  it('criar: grava com o user_id e devolve a área', async () => {
    const { fake, repositorio } = montar({ areas: [ok(linhaArea())] })

    await expect(repositorio.criar(USER_ID, { nome: 'Estudos', cor: '#10b981' })).resolves.toEqual(AREA)
    expect(argumentos(fake.consultas[0]!, 'insert')).toEqual([{ nome: 'Estudos', cor: '#10b981', user_id: USER_ID }])
  })

  it('criar: propaga o erro do banco', async () => {
    const { repositorio } = montar({ areas: [falha(ERRO)] })
    await expect(repositorio.criar(USER_ID, { nome: 'a', cor: '#000000' })).rejects.toBe(ERRO)
  })

  it('atualizar: filtra por id e user_id; NotFoundError sem linha; propaga erro', async () => {
    const { fake, repositorio } = montar({ areas: [ok(linhaArea()), ok(null), falha(ERRO)] })
    const payload = { nome: 'Estudos', cor: '#10b981' }

    await expect(repositorio.atualizar(USER_ID, ID, payload)).resolves.toEqual(AREA)
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'id', ID])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    await expect(repositorio.atualizar(USER_ID, ID, payload)).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.atualizar(USER_ID, ID, payload)).rejects.toBe(ERRO)
  })

  it('remover: filtra por id e user_id; NotFoundError sem linha; propaga erro', async () => {
    const { fake, repositorio } = montar({ areas: [ok([{ id: ID }]), ok([]), falha(ERRO)] })

    await expect(repositorio.remover(USER_ID, ID)).resolves.toBeUndefined()
    expect(usou(fake.consultas[0]!, 'delete')).toBe(true)
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    await expect(repositorio.remover(USER_ID, ID)).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.remover(USER_ID, ID)).rejects.toBe(ERRO)
  })

  describe('tarefas', () => {
    it('contarTarefas: conta só as tarefas da área do usuário', async () => {
      // O PostgREST devolve o total em `count`, ao lado de data/error.
      const { fake, repositorio } = montar({ tarefas: [{ data: null, error: null, count: 4 } as never] })

      await expect(repositorio.contarTarefas(USER_ID, ID)).resolves.toBe(4)
      expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'area_id', ID])
      expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('contarTarefas: count ausente vale 0', async () => {
      const { repositorio } = montar({ tarefas: [ok(null)] })
      await expect(repositorio.contarTarefas(USER_ID, ID)).resolves.toBe(0)
    })

    it.each(['PGRST205', '42P01'])('contarTarefas: tabela ainda inexistente (%s) vale 0', async (code) => {
      const { repositorio } = montar({ tarefas: [falha({ code, message: 'sem tabela' })] })
      await expect(repositorio.contarTarefas(USER_ID, ID)).resolves.toBe(0)
    })

    it('contarTarefas: propaga outros erros', async () => {
      const { repositorio } = montar({ tarefas: [falha(ERRO)] })
      await expect(repositorio.contarTarefas(USER_ID, ID)).rejects.toBe(ERRO)
    })

    it('moverTarefas: atualiza area_id só das tarefas do usuário naquela área', async () => {
      const { fake, repositorio } = montar({ tarefas: [ok(null), falha(ERRO)] })

      await expect(repositorio.moverTarefas(USER_ID, ID, ID_2)).resolves.toBeUndefined()
      expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ area_id: ID_2 }])
      expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'area_id', ID])
      expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
      await expect(repositorio.moverTarefas(USER_ID, ID, ID_2)).rejects.toBe(ERRO)
    })

    it('removerTarefas: apaga só as tarefas do usuário naquela área', async () => {
      const { fake, repositorio } = montar({ tarefas: [ok(null), falha(ERRO)] })

      await expect(repositorio.removerTarefas(USER_ID, ID)).resolves.toBeUndefined()
      expect(usou(fake.consultas[0]!, 'delete')).toBe(true)
      expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
      await expect(repositorio.removerTarefas(USER_ID, ID)).rejects.toBe(ERRO)
    })

    it('contarTarefasNoSprintAberto: conta só as tarefas cujo sprint está ABERTO, filtrando tudo por user_id', async () => {
      const { fake, repositorio } = montar({
        tarefas: [ok([{ sprint_id: 'a' }, { sprint_id: 'a' }, { sprint_id: 'b' }, { sprint_id: 'c' }])],
        sprints: [ok([{ id: 'a' }, { id: 'c' }])],
      })

      await expect(repositorio.contarTarefasNoSprintAberto(USER_ID, ID)).resolves.toBe(3)
      expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'area_id', ID])
      expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
      expect(fake.consultas[0]!.chamadas).toContainEqual(['not', 'sprint_id', 'is', null])
      expect(fake.consultas[1]!.tabela).toBe('sprints')
      expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
      expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'situacao', 'ABERTO'])
      expect(fake.consultas[1]!.chamadas).toContainEqual(['in', 'id', ['a', 'b', 'c']])
    })

    it('contarTarefasNoSprintAberto: sem tarefas em sprint vale 0, sem consultar sprints; tabela ausente vale 0', async () => {
      const vazio = montar({ tarefas: [ok([])] })
      await expect(vazio.repositorio.contarTarefasNoSprintAberto(USER_ID, ID)).resolves.toBe(0)
      expect(vazio.fake.consultas).toHaveLength(1)

      const ausente = montar({ tarefas: [falha({ code: 'PGRST205', message: 'sem tabela' })] })
      await expect(ausente.repositorio.contarTarefasNoSprintAberto(USER_ID, ID)).resolves.toBe(0)
    })

    it('contarTarefasNoSprintAberto: sprints todos fechados vale 0; propaga erro de qualquer consulta', async () => {
      const fechados = montar({ tarefas: [ok([{ sprint_id: 'a' }])], sprints: [ok([])] })
      await expect(fechados.repositorio.contarTarefasNoSprintAberto(USER_ID, ID)).resolves.toBe(0)

      const erroTarefas = montar({ tarefas: [falha(ERRO)] })
      await expect(erroTarefas.repositorio.contarTarefasNoSprintAberto(USER_ID, ID)).rejects.toBe(ERRO)

      const erroSprints = montar({ tarefas: [ok([{ sprint_id: 'a' }])], sprints: [falha(ERRO)] })
      await expect(erroSprints.repositorio.contarTarefasNoSprintAberto(USER_ID, ID)).rejects.toBe(ERRO)
    })

    it('contarTarefas: soma as Super tasks da área (também filtradas por user_id)', async () => {
      const { fake, repositorio } = montar({
        tarefas: [{ data: null, error: null, count: 4 } as never],
        super_tasks: [{ data: null, error: null, count: 2 } as never],
      })

      await expect(repositorio.contarTarefas(USER_ID, ID)).resolves.toBe(6)
      expect(fake.consultas[1]!.tabela).toBe('super_tasks')
      expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'area_id', ID])
      expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('contarTarefas: só Super tasks (count ausente nas tarefas) e erro das Super tasks propagado', async () => {
      const so = montar({ tarefas: [ok(null)], super_tasks: [{ data: null, error: null, count: 1 } as never] })
      await expect(so.repositorio.contarTarefas(USER_ID, ID)).resolves.toBe(1)

      const erro = montar({ tarefas: [ok(null)], super_tasks: [falha(ERRO)] })
      await expect(erro.repositorio.contarTarefas(USER_ID, ID)).rejects.toBe(ERRO)
    })

    it('moverTarefas: a Super task da área acompanha (só do usuário)', async () => {
      const { fake, repositorio } = montar({ tarefas: [ok(null), ok(null)], super_tasks: [ok(null), falha(ERRO)] })

      await repositorio.moverTarefas(USER_ID, ID, ID_2)
      expect(fake.consultas[1]!.tabela).toBe('super_tasks')
      expect(argumentos(fake.consultas[1]!, 'update')).toEqual([{ area_id: ID_2 }])
      expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])

      await expect(repositorio.moverTarefas(USER_ID, ID, ID_2)).rejects.toBe(ERRO)
    })

    it('removerTarefas: apaga também as Super tasks da área (só do usuário)', async () => {
      const { fake, repositorio } = montar({ tarefas: [ok(null), ok(null)], super_tasks: [ok(null), falha(ERRO)] })

      await repositorio.removerTarefas(USER_ID, ID)
      expect(fake.consultas[1]!.tabela).toBe('super_tasks')
      expect(usou(fake.consultas[1]!, 'delete')).toBe(true)
      expect(fake.consultas[1]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])

      await expect(repositorio.removerTarefas(USER_ID, ID)).rejects.toBe(ERRO)
    })
  })
})
