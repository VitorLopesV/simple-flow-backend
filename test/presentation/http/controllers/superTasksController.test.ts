import { beforeEach, describe, expect, it, vi } from 'vitest'

import { superTasksController } from '../../../../src/presentation/http/controllers/superTasksController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const CASOS_USO = [
  'AdicionarTarefaASuperTask',
  'ArquivarSuperTask',
  'AtualizarSuperTask',
  'ConverterTarefaEmSuperTask',
  'CriarSuperTask',
  'DesmarcarSuperTaskConcluida',
  'ListarSuperTasks',
  'MarcarSuperTaskConcluida',
  'MoverSuperTask',
  'ObterSuperTask',
  'RemoverSuperTask',
  'RetirarTarefaDaSuperTask',
] as const

const m = vi.hoisted(() => {
  const nomes = ['AdicionarTarefaASuperTask', 'ArquivarSuperTask', 'AtualizarSuperTask', 'ConverterTarefaEmSuperTask', 'CriarSuperTask', 'DesmarcarSuperTaskConcluida', 'ListarSuperTasks', 'MarcarSuperTaskConcluida', 'MoverSuperTask', 'ObterSuperTask', 'RemoverSuperTask', 'RetirarTarefaDaSuperTask']
  return {
    RepositorioSuperTask: vi.fn(function (client: unknown) { return { repositorio: 'superTasks', client } }),
    RepositorioTarefa: vi.fn(function (client: unknown) { return { repositorio: 'tarefas', client } }),
    RepositorioArea: vi.fn(function (client: unknown) { return { repositorio: 'areas', client } }),
    execute: vi.fn(),
    ctor: Object.fromEntries(nomes.map((nome) => [nome, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>,
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseSuperTaskRepository', () => ({ SupabaseSuperTaskRepository: m.RepositorioSuperTask }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseTarefaRepository', () => ({ SupabaseTarefaRepository: m.RepositorioTarefa }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseAreaRepository', () => ({ SupabaseAreaRepository: m.RepositorioArea }))
vi.mock('../../../../src/application/use-cases/superTasks/AdicionarTarefaASuperTask', () => ({ AdicionarTarefaASuperTask: m.ctor.AdicionarTarefaASuperTask }))
vi.mock('../../../../src/application/use-cases/superTasks/ArquivarSuperTask', () => ({ ArquivarSuperTask: m.ctor.ArquivarSuperTask }))
vi.mock('../../../../src/application/use-cases/superTasks/AtualizarSuperTask', () => ({ AtualizarSuperTask: m.ctor.AtualizarSuperTask }))
vi.mock('../../../../src/application/use-cases/superTasks/ConverterTarefaEmSuperTask', () => ({ ConverterTarefaEmSuperTask: m.ctor.ConverterTarefaEmSuperTask }))
vi.mock('../../../../src/application/use-cases/superTasks/CriarSuperTask', () => ({ CriarSuperTask: m.ctor.CriarSuperTask }))
vi.mock('../../../../src/application/use-cases/superTasks/DesmarcarSuperTaskConcluida', () => ({ DesmarcarSuperTaskConcluida: m.ctor.DesmarcarSuperTaskConcluida }))
vi.mock('../../../../src/application/use-cases/superTasks/ListarSuperTasks', () => ({ ListarSuperTasks: m.ctor.ListarSuperTasks }))
vi.mock('../../../../src/application/use-cases/superTasks/MarcarSuperTaskConcluida', () => ({ MarcarSuperTaskConcluida: m.ctor.MarcarSuperTaskConcluida }))
vi.mock('../../../../src/application/use-cases/superTasks/MoverSuperTask', () => ({ MoverSuperTask: m.ctor.MoverSuperTask }))
vi.mock('../../../../src/application/use-cases/superTasks/ObterSuperTask', () => ({ ObterSuperTask: m.ctor.ObterSuperTask }))
vi.mock('../../../../src/application/use-cases/superTasks/RemoverSuperTask', () => ({ RemoverSuperTask: m.ctor.RemoverSuperTask }))
vi.mock('../../../../src/application/use-cases/superTasks/RetirarTarefaDaSuperTask', () => ({ RetirarTarefaDaSuperTask: m.ctor.RetirarTarefaDaSuperTask }))

function repos() {
  return {
    superTask: m.RepositorioSuperTask.mock.results[0]?.value,
    tarefa: m.RepositorioTarefa.mock.results[0]?.value,
    area: m.RepositorioArea.mock.results[0]?.value,
  }
}

describe('superTasksController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const nome of CASOS_USO) {
      m.ctor[nome]!.mockImplementation(function () { return { execute: m.execute } })
    }
  })

  it('listar: repassa o filtro e responde a lista', async () => {
    m.execute.mockResolvedValue([{ id: 's' }])
    const req = criarRequisicao({ query: { areaId: 'a', arquivadas: true } })
    const res = criarResposta()

    await superTasksController.listar(req, res)

    expect(m.RepositorioSuperTask).toHaveBeenCalledWith(req.supabase)
    expect(m.ctor.ListarSuperTasks).toHaveBeenCalledWith(repos().superTask, repos().tarefa)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, { areaId: 'a', incluirArquivadas: true })
    expect(res.json).toHaveBeenCalledWith([{ id: 's' }])
  })

  it('obter: responde a Super task com as filhas', async () => {
    m.execute.mockResolvedValue({ id: 's' })
    const res = criarResposta()

    await superTasksController.obter(criarRequisicao({ params: { id: 's' } }), res)

    expect(m.ctor.ObterSuperTask).toHaveBeenCalledWith(repos().superTask, repos().tarefa)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, 's')
    expect(res.json).toHaveBeenCalledWith({ id: 's' })
  })

  it('criar: injeta os repositórios de Super task e área e responde 201', async () => {
    m.execute.mockResolvedValue({ id: 's' })
    const body = { titulo: 'x', areaId: 'a' }
    const res = criarResposta()

    await superTasksController.criar(criarRequisicao({ body }), res)

    expect(m.ctor.CriarSuperTask).toHaveBeenCalledWith(repos().superTask, repos().area)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, body)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('converter: passa a tarefa e a Data de término e responde 201', async () => {
    m.execute.mockResolvedValue({ id: 's' })
    const res = criarResposta()

    await superTasksController.converter(criarRequisicao({ body: { tarefaId: 't', dataTermino: '2026-12-20' } }), res)

    expect(m.ctor.ConverterTarefaEmSuperTask).toHaveBeenCalledWith(repos().tarefa, repos().superTask)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, 't', '2026-12-20')
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it('atualizar: passa a edição', async () => {
    m.execute.mockResolvedValue({ id: 's' })
    const res = criarResposta()

    await superTasksController.atualizar(criarRequisicao({ params: { id: 's' }, body: { titulo: 'y' } }), res)

    expect(m.ctor.AtualizarSuperTask).toHaveBeenCalledWith(repos().superTask, repos().tarefa)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, 's', { titulo: 'y' })
    expect(res.json).toHaveBeenCalledWith({ id: 's' })
  })

  it('mover: injeta Super task, tarefa e área', async () => {
    m.execute.mockResolvedValue({ id: 's' })

    await superTasksController.mover(criarRequisicao({ params: { id: 's' }, body: { areaId: 'a2' } }), criarResposta())

    expect(m.ctor.MoverSuperTask).toHaveBeenCalledWith(repos().superTask, repos().tarefa, repos().area)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, 's', 'a2')
  })

  it('concluir e desmarcarConclusao: respondem a Super task', async () => {
    m.execute.mockResolvedValue({ id: 's' })
    const res1 = criarResposta()
    const res2 = criarResposta()

    await superTasksController.concluir(criarRequisicao({ params: { id: 's' } }), res1)
    await superTasksController.desmarcarConclusao(criarRequisicao({ params: { id: 's' } }), res2)

    expect(m.ctor.MarcarSuperTaskConcluida).toHaveBeenCalledWith(repos().superTask, repos().tarefa)
    expect(m.ctor.DesmarcarSuperTaskConcluida).toHaveBeenCalledWith(repos().superTask, repos().tarefa)
    expect(res1.json).toHaveBeenCalledWith({ id: 's' })
    expect(res2.json).toHaveBeenCalledWith({ id: 's' })
  })

  it('arquivar e desarquivar: o mesmo use-case com true/false', async () => {
    m.execute.mockResolvedValue({ id: 's' })

    await superTasksController.arquivar(criarRequisicao({ params: { id: 's' } }), criarResposta())
    await superTasksController.desarquivar(criarRequisicao({ params: { id: 's' } }), criarResposta())

    expect(m.execute).toHaveBeenNthCalledWith(1, USUARIO.id, 's', true)
    expect(m.execute).toHaveBeenNthCalledWith(2, USUARIO.id, 's', false)
  })

  it('remover: repassa o destino das filhas e responde 204', async () => {
    m.execute.mockResolvedValue(undefined)
    const res = criarResposta()

    await superTasksController.remover(criarRequisicao({ params: { id: 's' }, query: { filhas: 'EXCLUIR' } }), res)

    expect(m.ctor.RemoverSuperTask).toHaveBeenCalledWith(repos().superTask, repos().tarefa)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, 's', 'EXCLUIR')
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('adicionarFilha: responde 201; retirarFilha: responde a Super task', async () => {
    m.execute.mockResolvedValue({ id: 's' })
    const res1 = criarResposta()
    const res2 = criarResposta()

    await superTasksController.adicionarFilha(criarRequisicao({ params: { id: 's' }, body: { tarefaId: 't' } }), res1)
    await superTasksController.retirarFilha(criarRequisicao({ params: { id: 's', tarefaId: 't' } }), res2)

    expect(m.ctor.AdicionarTarefaASuperTask).toHaveBeenCalledWith(repos().superTask, repos().tarefa)
    expect(m.ctor.RetirarTarefaDaSuperTask).toHaveBeenCalledWith(repos().superTask, repos().tarefa)
    expect(m.execute).toHaveBeenNthCalledWith(1, USUARIO.id, 's', 't')
    expect(m.execute).toHaveBeenNthCalledWith(2, USUARIO.id, 's', 't')
    expect(res1.status).toHaveBeenCalledWith(201)
    expect(res2.json).toHaveBeenCalledWith({ id: 's' })
  })

  it('propaga o erro do use-case sem responder', async () => {
    const erro = new Error('falha')
    m.execute.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(superTasksController.obter(criarRequisicao({ params: { id: 's' } }), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })
})
