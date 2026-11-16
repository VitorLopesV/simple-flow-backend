import { beforeEach, describe, expect, it, vi } from 'vitest'

import { tarefasController } from '../../../../src/presentation/http/controllers/tarefasController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => ({
  RepositorioTarefa: vi.fn(function (client: unknown) { return { repositorio: 'tarefas', client } }),
  RepositorioArea: vi.fn(function (client: unknown) { return { repositorio: 'areas', client } }),
  listar: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  mover: vi.fn(),
  arquivar: vi.fn(),
  desarquivar: vi.fn(),
  remover: vi.fn(),
  ListarTarefas: vi.fn(),
  CriarTarefa: vi.fn(),
  AtualizarTarefa: vi.fn(),
  MoverTarefa: vi.fn(),
  ArquivarTarefa: vi.fn(),
  DesarquivarTarefa: vi.fn(),
  RemoverTarefa: vi.fn(),
}))

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseTarefaRepository', () => ({ SupabaseTarefaRepository: m.RepositorioTarefa }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseAreaRepository', () => ({ SupabaseAreaRepository: m.RepositorioArea }))
vi.mock('../../../../src/application/use-cases/tarefas/ListarTarefas', () => ({ ListarTarefas: m.ListarTarefas }))
vi.mock('../../../../src/application/use-cases/tarefas/CriarTarefa', () => ({ CriarTarefa: m.CriarTarefa }))
vi.mock('../../../../src/application/use-cases/tarefas/AtualizarTarefa', () => ({ AtualizarTarefa: m.AtualizarTarefa }))
vi.mock('../../../../src/application/use-cases/tarefas/MoverTarefa', () => ({ MoverTarefa: m.MoverTarefa }))
vi.mock('../../../../src/application/use-cases/tarefas/ArquivarTarefa', () => ({ ArquivarTarefa: m.ArquivarTarefa }))
vi.mock('../../../../src/application/use-cases/tarefas/DesarquivarTarefa', () => ({ DesarquivarTarefa: m.DesarquivarTarefa }))
vi.mock('../../../../src/application/use-cases/tarefas/RemoverTarefa', () => ({ RemoverTarefa: m.RemoverTarefa }))

describe('tarefasController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.ListarTarefas.mockImplementation(function () { return { execute: m.listar } })
    m.CriarTarefa.mockImplementation(function () { return { execute: m.criar } })
    m.AtualizarTarefa.mockImplementation(function () { return { execute: m.atualizar } })
    m.MoverTarefa.mockImplementation(function () { return { execute: m.mover } })
    m.ArquivarTarefa.mockImplementation(function () { return { execute: m.arquivar } })
    m.DesarquivarTarefa.mockImplementation(function () { return { execute: m.desarquivar } })
    m.RemoverTarefa.mockImplementation(function () { return { execute: m.remover } })
  })

  it('listar: compõe o repositório com o client da requisição e repassa o filtro', async () => {
    m.listar.mockResolvedValue([{ id: 't' }])
    const req = criarRequisicao({ query: { areaId: 'a', arquivadas: true } })
    const res = criarResposta()

    await tarefasController.listar(req, res)

    expect(m.RepositorioTarefa).toHaveBeenCalledWith(req.supabase)
    expect(m.ListarTarefas).toHaveBeenCalledWith(m.RepositorioTarefa.mock.results[0]!.value)
    expect(m.listar).toHaveBeenCalledWith(USUARIO.id, { areaId: 'a', incluirArquivadas: true })
    expect(res.json).toHaveBeenCalledWith([{ id: 't' }])
  })

  it('criar: injeta os repositórios de tarefa e área e responde 201', async () => {
    m.criar.mockResolvedValue({ id: 't' })
    const body = { titulo: 'x', areaId: 'a' }
    const req = criarRequisicao({ body })
    const res = criarResposta()

    await tarefasController.criar(req, res)

    expect(m.CriarTarefa).toHaveBeenCalledWith(m.RepositorioTarefa.mock.results[0]!.value, m.RepositorioArea.mock.results[0]!.value)
    expect(m.RepositorioArea).toHaveBeenCalledWith(req.supabase)
    expect(m.criar).toHaveBeenCalledWith(USUARIO.id, body)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 't' })
  })

  it('atualizar: responde com a tarefa atualizada', async () => {
    m.atualizar.mockResolvedValue({ id: 't' })
    const body = { titulo: 'x' }
    const res = criarResposta()

    await tarefasController.atualizar(criarRequisicao({ body, params: { id: 't' } }), res)

    expect(m.atualizar).toHaveBeenCalledWith(USUARIO.id, 't', body)
    expect(res.json).toHaveBeenCalledWith({ id: 't' })
  })

  it('mover: passa a área de destino e os dois repositórios', async () => {
    m.mover.mockResolvedValue({ id: 't' })
    const res = criarResposta()

    await tarefasController.mover(criarRequisicao({ body: { areaId: 'b' }, params: { id: 't' } }), res)

    expect(m.MoverTarefa).toHaveBeenCalledWith(m.RepositorioTarefa.mock.results[0]!.value, m.RepositorioArea.mock.results[0]!.value)
    expect(m.mover).toHaveBeenCalledWith(USUARIO.id, 't', 'b')
    expect(res.json).toHaveBeenCalledWith({ id: 't' })
  })

  it('arquivar e desarquivar: respondem com a tarefa', async () => {
    m.arquivar.mockResolvedValue({ id: 't', arquivada: true })
    m.desarquivar.mockResolvedValue({ id: 't', arquivada: false })
    const res1 = criarResposta()
    const res2 = criarResposta()

    await tarefasController.arquivar(criarRequisicao({ params: { id: 't' } }), res1)
    await tarefasController.desarquivar(criarRequisicao({ params: { id: 't' } }), res2)

    expect(m.arquivar).toHaveBeenCalledWith(USUARIO.id, 't')
    expect(m.desarquivar).toHaveBeenCalledWith(USUARIO.id, 't')
    expect(res1.json).toHaveBeenCalledWith({ id: 't', arquivada: true })
    expect(res2.json).toHaveBeenCalledWith({ id: 't', arquivada: false })
  })

  it('remover: responde 204', async () => {
    m.remover.mockResolvedValue(undefined)
    const res = criarResposta()

    await tarefasController.remover(criarRequisicao({ params: { id: 't' } }), res)

    expect(m.remover).toHaveBeenCalledWith(USUARIO.id, 't')
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
  })

  it('propaga o erro do use-case sem responder', async () => {
    const erro = new Error('x')
    m.remover.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(tarefasController.remover(criarRequisicao({ params: { id: 't' } }), res)).rejects.toBe(erro)
    expect(res.status).not.toHaveBeenCalled()
  })
})
