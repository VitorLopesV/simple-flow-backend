import { beforeEach, describe, expect, it } from 'vitest'

import { AdicionarTarefaASuperTask } from '../../../../src/application/use-cases/superTasks/AdicionarTarefaASuperTask'
import { DesmarcarSuperTaskConcluida } from '../../../../src/application/use-cases/superTasks/DesmarcarSuperTaskConcluida'
import { MarcarSuperTaskConcluida } from '../../../../src/application/use-cases/superTasks/MarcarSuperTaskConcluida'
import { ObterSuperTask } from '../../../../src/application/use-cases/superTasks/ObterSuperTask'
import { RetirarTarefaDaSuperTask } from '../../../../src/application/use-cases/superTasks/RetirarTarefaDaSuperTask'
import { ConcluirTarefa } from '../../../../src/application/use-cases/tarefas/ConcluirTarefa'
import { MoverTarefa } from '../../../../src/application/use-cases/tarefas/MoverTarefa'
import { RemoverTarefa } from '../../../../src/application/use-cases/tarefas/RemoverTarefa'
import type { SuperTask } from '../../../../src/domain/entities/SuperTask'
import type { Tarefa } from '../../../../src/domain/entities/Tarefa'
import { ConflictError, ValidationError } from '../../../../src/domain/errors/DomainError'
import {
  criarAreaRepositoryFake,
  criarSprintRepositoryFake,
  criarSuperTaskRepositoryFake,
  criarTarefaRepositoryFake,
} from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
// Segunda 2026-11-16, 12:00 em São Paulo; todas as conclusões acontecem em dias úteis seguidos.
const T1 = new Date('2026-11-16T15:00:00.000Z')
const T2 = new Date('2026-11-17T15:00:00.000Z')
const T3 = new Date('2026-11-18T15:00:00.000Z')
const T4 = new Date('2026-11-19T15:00:00.000Z')
const T5 = new Date('2026-11-20T15:00:00.000Z')

function tarefa(id: string, sobrescritas: Partial<Tarefa> = {}): Tarefa {
  return {
    id,
    areaId: 'area-1',
    titulo: id,
    dia: null,
    hora: null,
    tempoEstimado: null,
    dificuldade: null,
    prioridade: null,
    notas: null,
    sprintId: null,
    superTaskId: null,
    concluidaEm: null,
    concluida: false,
    atrasada: false,
    arquivada: false,
    arquivadaEm: null,
    criadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

/** Repositórios em memória com o mesmo contrato dos reais: só o necessário para o ciclo completo. */
function montar() {
  const superTask: { atual: SuperTask } = {
    atual: {
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
    },
  }
  const tarefasPorId = new Map<string, Tarefa>()

  const superTasks = criarSuperTaskRepositoryFake()
  superTasks.buscarPorId.mockImplementation(async () => superTask.atual)
  superTasks.definirConclusao.mockImplementation(async (_u: string, _id: string, quando: string | null) => {
    superTask.atual = { ...superTask.atual, concluidaEm: quando, concluida: quando !== null }
    return superTask.atual
  })

  const tarefas = criarTarefaRepositoryFake()
  tarefas.buscarPorId.mockImplementation(async (_u: string, id: string) => tarefasPorId.get(id) ?? null)
  tarefas.listarDasSuperTasks.mockImplementation(async () => [...tarefasPorId.values()].filter((t) => t.superTaskId === 'st-1'))
  tarefas.definirSuperTask.mockImplementation(async (_u: string, id: string, superTaskId: string | null) => {
    const atualizada = { ...tarefasPorId.get(id)!, superTaskId }
    tarefasPorId.set(id, atualizada)
    return atualizada
  })
  tarefas.concluir.mockImplementation(async (_u: string, id: string, quando: string) => {
    const atualizada = { ...tarefasPorId.get(id)!, concluida: true, concluidaEm: quando }
    tarefasPorId.set(id, atualizada)
    return atualizada
  })
  tarefas.remover.mockImplementation(async (_u: string, id: string) => {
    tarefasPorId.delete(id)
  })

  const sprints = criarSprintRepositoryFake()
  // Sem pontuação completa a tarefa nunca entra no sprint por conclusão; basta o fake responder.
  sprints.garantir.mockResolvedValue({ id: 'spr-1', inicio: '2026-11-16', fim: '2026-11-20' })

  return { superTask, tarefasPorId, superTasks, tarefas, sprints }
}

let c: ReturnType<typeof montar>
const adicionar = (id: string) => new AdicionarTarefaASuperTask(c.superTasks, c.tarefas).execute(USER_ID, 'st-1', id, T1)
const concluir = (id: string, quando: Date) => new ConcluirTarefa(c.tarefas, c.sprints, c.superTasks).execute(USER_ID, id, quando)
const obter = () => new ObterSuperTask(c.superTasks, c.tarefas).execute(USER_ID, 'st-1', T5)

beforeEach(() => {
  c = montar()
  c.tarefasPorId.set('a', tarefa('a'))
  c.tarefasPorId.set('b', tarefa('b'))
  c.tarefasPorId.set('c', tarefa('c'))
})

describe('ciclo da Super task: concluir → desmarcar → adicionar filha → concluir de novo', () => {
  it('percorre o ciclo inteiro com progresso e estado derivados a cada passo', async () => {
    // Sem filhas: 0%, não iniciada.
    expect(await obter()).toMatchObject({ totalFilhas: 0, progresso: 0, estado: 'NAO_INICIADA' })

    await adicionar('a')
    await adicionar('b')
    expect(await obter()).toMatchObject({ totalFilhas: 2, progresso: 0, estado: 'NAO_INICIADA' })

    // Concluir a primeira filha: 50%, em andamento, Super task segue aberta.
    await concluir('a', T1)
    expect(await obter()).toMatchObject({ progresso: 50, estado: 'EM_ANDAMENTO', concluida: false })

    // Nunca marcar abaixo de 100%.
    await expect(new MarcarSuperTaskConcluida(c.superTasks, c.tarefas).execute(USER_ID, 'st-1', T2)).rejects.toBeInstanceOf(ValidationError)

    // Concluir a última filha: 100% e a Super task se conclui sozinha.
    await concluir('b', T2)
    expect(await obter()).toMatchObject({ progresso: 100, estado: 'CONCLUIDA', concluida: true, concluidaEm: T2.toISOString() })

    // Concluída: trava e não aceita filhas novas.
    await expect(adicionar('c')).rejects.toBeInstanceOf(ConflictError)

    // Desmarcar reabre; as filhas concluídas continuam concluídas, ainda em 100%.
    const reaberta = await new DesmarcarSuperTaskConcluida(c.superTasks, c.tarefas).execute(USER_ID, 'st-1', T3)
    expect(reaberta).toMatchObject({ concluida: false, progresso: 100, podeConcluir: true })
    expect(reaberta.filhas.every((filha) => filha.concluida)).toBe(true)

    // Entra uma filha nova: volta a "em andamento" (67%) e não se conclui sozinha.
    await adicionar('c')
    expect(await obter()).toMatchObject({ totalFilhas: 3, progresso: 66, estado: 'EM_ANDAMENTO', podeConcluir: false })

    // Concluir a filha nova fecha de novo, automaticamente.
    await concluir('c', T4)
    expect(await obter()).toMatchObject({ progresso: 100, estado: 'CONCLUIDA', concluida: true, concluidaEm: T4.toISOString() })
  })

  it('reaberta e ainda em 100%, pode ser marcada concluída de novo (sem confirmação)', async () => {
    await adicionar('a')
    await concluir('a', T1)
    expect((await obter()).concluida).toBe(true)

    await new DesmarcarSuperTaskConcluida(c.superTasks, c.tarefas).execute(USER_ID, 'st-1', T2)
    // Concluir de novo a filha (idempotente) NÃO reconclui a Super task reaberta de propósito.
    await concluir('a', T3)
    expect((await obter()).concluida).toBe(false)

    const marcada = await new MarcarSuperTaskConcluida(c.superTasks, c.tarefas).execute(USER_ID, 'st-1', T4)
    expect(marcada).toMatchObject({ concluida: true, concluidaEm: T4.toISOString(), estado: 'CONCLUIDA' })
  })
})

describe('conclusão automática por outros caminhos', () => {
  it('excluir a única filha que faltava (ela sai da conta) conclui a Super task', async () => {
    await adicionar('a')
    await adicionar('b')
    await concluir('a', T1)

    await new RemoverTarefa(c.tarefas, c.superTasks).execute(USER_ID, 'b', T2)

    expect(await obter()).toMatchObject({ totalFilhas: 1, progresso: 100, concluida: true })
  })

  it('excluir a única filha de todas deixa 0% e não iniciada, sem concluir', async () => {
    await adicionar('a')

    await new RemoverTarefa(c.tarefas, c.superTasks).execute(USER_ID, 'a', T2)

    expect(await obter()).toMatchObject({ totalFilhas: 0, progresso: 0, estado: 'NAO_INICIADA', concluida: false })
  })

  it('excluir tarefa avulsa não mexe na Super task', async () => {
    await new RemoverTarefa(c.tarefas, c.superTasks).execute(USER_ID, 'c', T2)
    expect(c.superTasks.buscarPorId).not.toHaveBeenCalled()
  })

  it('retirar a única filha que faltava conclui a Super task', async () => {
    await adicionar('a')
    await adicionar('b')
    await concluir('a', T1)

    await new RetirarTarefaDaSuperTask(c.superTasks, c.tarefas).execute(USER_ID, 'st-1', 'b', T2)

    expect(await obter()).toMatchObject({ totalFilhas: 1, progresso: 100, concluida: true })
    expect(c.tarefasPorId.get('b')!.superTaskId).toBeNull()
  })

  it('concluir tarefa avulsa não consulta nenhuma Super task', async () => {
    await concluir('c', T1)
    expect(c.superTasks.buscarPorId).not.toHaveBeenCalled()
  })
})

describe('filha concluída: conflito explícito com as regras da #70', () => {
  it('não sai da Super task nem muda de área (409), e a Super task segue contando-a como feita', async () => {
    await adicionar('a')
    await adicionar('b')
    await concluir('a', T1)

    await expect(new RetirarTarefaDaSuperTask(c.superTasks, c.tarefas).execute(USER_ID, 'st-1', 'a', T2)).rejects.toBeInstanceOf(ConflictError)
    await expect(new MoverTarefa(c.tarefas, criarAreaRepositoryFake()).execute(USER_ID, 'a', 'area-2', T2)).rejects.toBeInstanceOf(ConflictError)

    expect(c.tarefasPorId.get('a')!.superTaskId).toBe('st-1')
    expect(await obter()).toMatchObject({ filhasConcluidas: 1, progresso: 50 })
  })

  it('filha aberta não muda de área sozinha (leva a Super task junto): 409 explícito', async () => {
    await adicionar('a')
    const areas = criarAreaRepositoryFake()
    areas.buscarPorId.mockResolvedValue({ id: 'area-2', nome: 'Outra', cor: '#fff', sistema: false, criadoEm: '' })

    await expect(new MoverTarefa(c.tarefas, areas).execute(USER_ID, 'a', 'area-2', T2)).rejects.toThrow(/filha de uma Super task/)
    expect(c.tarefas.mover).not.toHaveBeenCalled()
  })

  it('mover a filha para a própria área (sem mudança) segue sendo no-op', async () => {
    await adicionar('a')
    const areas = criarAreaRepositoryFake()
    areas.buscarPorId.mockResolvedValue({ id: 'area-1', nome: 'Casa', cor: '#fff', sistema: false, criadoEm: '' })

    await new MoverTarefa(c.tarefas, areas).execute(USER_ID, 'a', 'area-1', T2)
    expect(c.tarefas.mover).not.toHaveBeenCalled()
  })
})
