import { beforeEach, describe, expect, it, vi } from 'vitest'

import { areasController } from '../../../../src/presentation/http/controllers/areasController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => ({
  Repositorio: vi.fn(function (client: unknown) { return { repositorio: 'areas', client } }),
  listar: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  remover: vi.fn(),
  ListarAreas: vi.fn(),
  CriarArea: vi.fn(),
  AtualizarArea: vi.fn(),
  RemoverArea: vi.fn(),
}))

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseAreaRepository', () => ({ SupabaseAreaRepository: m.Repositorio }))
vi.mock('../../../../src/application/use-cases/areas/ListarAreas', () => ({ ListarAreas: m.ListarAreas }))
vi.mock('../../../../src/application/use-cases/areas/CriarArea', () => ({ CriarArea: m.CriarArea }))
vi.mock('../../../../src/application/use-cases/areas/AtualizarArea', () => ({ AtualizarArea: m.AtualizarArea }))
vi.mock('../../../../src/application/use-cases/areas/RemoverArea', () => ({ RemoverArea: m.RemoverArea }))

describe('areasController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.ListarAreas.mockImplementation(function () { return { execute: m.listar } })
    m.CriarArea.mockImplementation(function () { return { execute: m.criar } })
    m.AtualizarArea.mockImplementation(function () { return { execute: m.atualizar } })
    m.RemoverArea.mockImplementation(function () { return { execute: m.remover } })
  })

  it('listar: compõe repositório e use-case com o client da requisição e responde com as áreas', async () => {
    m.listar.mockResolvedValue([{ id: 'a' }])
    const req = criarRequisicao()
    const res = criarResposta()

    await areasController.listar(req, res)

    expect(m.Repositorio).toHaveBeenCalledWith(req.supabase)
    expect(m.ListarAreas).toHaveBeenCalledWith(m.Repositorio.mock.results[0]!.value)
    expect(m.listar).toHaveBeenCalledWith(USUARIO.id)
    expect(res.json).toHaveBeenCalledWith([{ id: 'a' }])
  })

  it('criar: responde 201 com a área', async () => {
    m.criar.mockResolvedValue({ id: 'a' })
    const body = { nome: 'Estudos', cor: '#10b981' }
    const res = criarResposta()

    await areasController.criar(criarRequisicao({ body }), res)

    expect(m.criar).toHaveBeenCalledWith(USUARIO.id, body)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 'a' })
  })

  it('atualizar: responde com a área atualizada', async () => {
    m.atualizar.mockResolvedValue({ id: 'a' })
    const body = { nome: 'Estudos', cor: '#10b981' }
    const res = criarResposta()

    await areasController.atualizar(criarRequisicao({ body, params: { id: 'a' } }), res)

    expect(m.atualizar).toHaveBeenCalledWith(USUARIO.id, 'a', body)
    expect(res.json).toHaveBeenCalledWith({ id: 'a' })
  })

  it.each([
    [{}, undefined],
    [{ tarefas: 'excluir' }, { acao: 'EXCLUIR' }],
    [{ tarefas: 'mover', destinoId: 'b' }, { acao: 'MOVER', areaDestinoId: 'b' }],
  ])('remover: query %j vira o destino %j e responde 204', async (query, destino) => {
    m.remover.mockResolvedValue(undefined)
    const res = criarResposta()

    await areasController.remover(criarRequisicao({ query, params: { id: 'a' } }), res)

    expect(m.remover).toHaveBeenCalledWith(USUARIO.id, 'a', destino)
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.send).toHaveBeenCalled()
  })

  it('propaga o erro do use-case sem responder', async () => {
    const erro = new Error('x')
    m.remover.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(areasController.remover(criarRequisicao({ params: { id: 'a' } }), res)).rejects.toBe(erro)
    expect(res.status).not.toHaveBeenCalled()
  })
})
