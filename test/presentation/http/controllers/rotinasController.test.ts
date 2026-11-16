import { beforeEach, describe, expect, it, vi } from 'vitest'

import { rotinasController } from '../../../../src/presentation/http/controllers/rotinasController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => ({
  RepositorioItem: vi.fn(function (client: unknown) { return { repositorio: 'itens', client } }),
  RepositorioArea: vi.fn(function (client: unknown) { return { repositorio: 'areas', client } }),
  listar: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  remover: vi.fn(),
  ListarItensRotina: vi.fn(),
  CriarItemRotina: vi.fn(),
  AtualizarItemRotina: vi.fn(),
  RemoverItemRotina: vi.fn(),
}))

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseItemRotinaRepository', () => ({ SupabaseItemRotinaRepository: m.RepositorioItem }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseAreaRepository', () => ({ SupabaseAreaRepository: m.RepositorioArea }))
vi.mock('../../../../src/application/use-cases/rotinas/ListarItensRotina', () => ({ ListarItensRotina: m.ListarItensRotina }))
vi.mock('../../../../src/application/use-cases/rotinas/CriarItemRotina', () => ({ CriarItemRotina: m.CriarItemRotina }))
vi.mock('../../../../src/application/use-cases/rotinas/AtualizarItemRotina', () => ({ AtualizarItemRotina: m.AtualizarItemRotina }))
vi.mock('../../../../src/application/use-cases/rotinas/RemoverItemRotina', () => ({ RemoverItemRotina: m.RemoverItemRotina }))

describe('rotinasController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.ListarItensRotina.mockImplementation(function () { return { execute: m.listar } })
    m.CriarItemRotina.mockImplementation(function () { return { execute: m.criar } })
    m.AtualizarItemRotina.mockImplementation(function () { return { execute: m.atualizar } })
    m.RemoverItemRotina.mockImplementation(function () { return { execute: m.remover } })
  })

  it('listar: compõe o repositório com o client da requisição', async () => {
    m.listar.mockResolvedValue([{ id: 'r' }])
    const req = criarRequisicao()
    const res = criarResposta()

    await rotinasController.listar(req, res)

    expect(m.RepositorioItem).toHaveBeenCalledWith(req.supabase)
    expect(m.ListarItensRotina).toHaveBeenCalledWith(m.RepositorioItem.mock.results[0]!.value)
    expect(m.listar).toHaveBeenCalledWith(USUARIO.id)
    expect(res.json).toHaveBeenCalledWith([{ id: 'r' }])
  })

  it('criar: injeta os repositórios de item e área e responde 201', async () => {
    m.criar.mockResolvedValue({ id: 'r' })
    const body = { nome: 'x' }
    const req = criarRequisicao({ body })
    const res = criarResposta()

    await rotinasController.criar(req, res)

    expect(m.RepositorioArea).toHaveBeenCalledWith(req.supabase)
    expect(m.CriarItemRotina).toHaveBeenCalledWith(m.RepositorioItem.mock.results[0]!.value, m.RepositorioArea.mock.results[0]!.value)
    expect(m.criar).toHaveBeenCalledWith(USUARIO.id, body)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 'r' })
  })

  it('atualizar: responde com o item atualizado', async () => {
    m.atualizar.mockResolvedValue({ id: 'r' })
    const body = { nome: 'x' }
    const res = criarResposta()

    await rotinasController.atualizar(criarRequisicao({ body, params: { id: 'r' } }), res)

    expect(m.atualizar).toHaveBeenCalledWith(USUARIO.id, 'r', body)
    expect(res.json).toHaveBeenCalledWith({ id: 'r' })
  })

  it('remover: responde 204', async () => {
    const res = criarResposta()

    await rotinasController.remover(criarRequisicao({ params: { id: 'r' } }), res)

    expect(m.remover).toHaveBeenCalledWith(USUARIO.id, 'r')
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
  })

  it('propaga o erro do use-case sem responder', async () => {
    const erro = new Error('falha')
    m.remover.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(rotinasController.remover(criarRequisicao({ params: { id: 'r' } }), res)).rejects.toBe(erro)
    expect(res.status).not.toHaveBeenCalled()
  })
})
