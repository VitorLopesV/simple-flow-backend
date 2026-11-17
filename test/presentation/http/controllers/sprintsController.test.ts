import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sprintsController } from '../../../../src/presentation/http/controllers/sprintsController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => ({
  RepositorioSprint: vi.fn(function (client: unknown) { return { repositorio: 'sprints', client } }),
  RepositorioOcorrencia: vi.fn(function (client: unknown) { return { repositorio: 'ocorrencias', client } }),
  RepositorioItem: vi.fn(function (client: unknown) { return { repositorio: 'itens', client } }),
  execute: vi.fn(),
  ObterSprint: vi.fn(),
  RepositorioTarefas: vi.fn(function (client: unknown) { return { repositorio: 'tarefas', client } }),
  RepositorioTarefa: vi.fn(function (client: unknown) { return { repositorio: 'tarefa', client } }),
  executeAdicionar: vi.fn(),
  executeMover: vi.fn(),
  executeRemover: vi.fn(),
  Adicionar: vi.fn(),
  Mover: vi.fn(),
  Remover: vi.fn(),
  executePlacar: vi.fn(),
  ObterPlacar: vi.fn(),
  FecharVencidos: vi.fn(),
  RepositorioRecompensa: vi.fn(function (client: unknown) { return { repositorio: 'recompensa', client } }),
  DefinirRecompensa: vi.fn(),
  executeDefinirRecompensa: vi.fn(),
  ObterPadrao: vi.fn(),
  executeObterPadrao: vi.fn(),
  DefinirPadrao: vi.fn(),
  executeDefinirPadrao: vi.fn(),
  Historico: vi.fn(),
  executeHistorico: vi.fn(),
}))

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseSprintRepository', () => ({ SupabaseSprintRepository: m.RepositorioSprint }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository', () => ({ SupabaseOcorrenciaRotinaRepository: m.RepositorioOcorrencia }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseItemRotinaRepository', () => ({ SupabaseItemRotinaRepository: m.RepositorioItem }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository', () => ({ SupabaseTarefasDoSprintRepository: m.RepositorioTarefas }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseTarefaRepository', () => ({ SupabaseTarefaRepository: m.RepositorioTarefa }))
vi.mock('../../../../src/application/use-cases/sprints/AdicionarTarefaAoSprint', () => ({ AdicionarTarefaAoSprint: m.Adicionar }))
vi.mock('../../../../src/application/use-cases/sprints/MoverTarefaNoSprint', () => ({ MoverTarefaNoSprint: m.Mover }))
vi.mock('../../../../src/application/use-cases/sprints/RemoverTarefaDoSprint', () => ({ RemoverTarefaDoSprint: m.Remover }))
vi.mock('../../../../src/application/use-cases/sprints/ObterPlacarDoSprint', () => ({ ObterPlacarDoSprint: m.ObterPlacar }))
vi.mock('../../../../src/application/use-cases/sprints/FecharSprintsVencidos', () => ({ FecharSprintsVencidos: m.FecharVencidos }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseRecompensaPadraoRepository', () => ({ SupabaseRecompensaPadraoRepository: m.RepositorioRecompensa }))
vi.mock('../../../../src/application/use-cases/sprints/DefinirRecompensaDoSprint', () => ({ DefinirRecompensaDoSprint: m.DefinirRecompensa }))
vi.mock('../../../../src/application/use-cases/sprints/RecompensaPadrao', () => ({ ObterRecompensaPadrao: m.ObterPadrao, DefinirRecompensaPadrao: m.DefinirPadrao }))
vi.mock('../../../../src/application/use-cases/sprints/ListarHistoricoDeSprints', () => ({ ListarHistoricoDeSprints: m.Historico }))
vi.mock('../../../../src/application/use-cases/sprints/ObterSprint', () => ({ ObterSprint: m.ObterSprint }))

describe('sprintsController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.FecharVencidos.mockImplementation(function (...deps: unknown[]) { return { reserva: 'fecharVencidos', deps } })
    m.ObterSprint.mockImplementation(function () { return { execute: m.execute } })
    m.ObterPlacar.mockImplementation(function () { return { execute: m.executePlacar } })
    m.Adicionar.mockImplementation(function () { return { execute: m.executeAdicionar } })
    m.Mover.mockImplementation(function () { return { execute: m.executeMover } })
    m.Remover.mockImplementation(function () { return { execute: m.executeRemover } })
    m.DefinirRecompensa.mockImplementation(function () { return { execute: m.executeDefinirRecompensa } })
    m.ObterPadrao.mockImplementation(function () { return { execute: m.executeObterPadrao } })
    m.DefinirPadrao.mockImplementation(function () { return { execute: m.executeDefinirPadrao } })
    m.Historico.mockImplementation(function () { return { execute: m.executeHistorico } })
  })

  it.each([
    ['atual', 'ATUAL'],
    ['proximo', 'PROXIMO'],
  ] as const)('%s: compõe os repositórios com o client da requisição e responde o sprint', async (acao, alvo) => {
    m.execute.mockResolvedValue({ sprint: { id: 's' } })
    const req = criarRequisicao()
    const res = criarResposta()

    await sprintsController[acao](req, res)

    expect(m.RepositorioSprint).toHaveBeenCalledWith(req.supabase)
    expect(m.RepositorioOcorrencia).toHaveBeenCalledWith(req.supabase)
    expect(m.RepositorioItem).toHaveBeenCalledWith(req.supabase)
    expect(m.ObterSprint).toHaveBeenCalledWith(
      m.RepositorioSprint.mock.results[0]!.value,
      m.RepositorioOcorrencia.mock.results[0]!.value,
      m.RepositorioItem.mock.results[0]!.value,
      m.FecharVencidos.mock.results[0]!.value,
      expect.objectContaining({ repositorio: 'recompensa' }),
    )
    // Reserva do job de fechamento (#71): sprint, ocorrências e tarefas do sprint, todos com o client da requisição.
    expect(m.FecharVencidos).toHaveBeenCalledTimes(1)
    expect(m.FecharVencidos).toHaveBeenCalledWith(
      m.RepositorioSprint.mock.results[1]!.value,
      m.RepositorioOcorrencia.mock.results[1]!.value,
      m.RepositorioTarefas.mock.results[0]!.value,
      expect.objectContaining({ repositorio: 'recompensa' }),
    )
    expect(m.RepositorioTarefas).toHaveBeenCalledWith(req.supabase)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, alvo)
    expect(res.json).toHaveBeenCalledWith({ sprint: { id: 's' } })
  })

  it('propaga o erro do use-case sem responder', async () => {
    const erro = new Error('falha')
    m.execute.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(sprintsController.atual(criarRequisicao(), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })

  it.each([
    ['placarAtual', 'ATUAL'],
    ['placarProximo', 'PROXIMO'],
  ] as const)('%s: compõe o placar com o sprint e as tarefas e responde o resultado', async (acao, alvo) => {
    m.executePlacar.mockResolvedValue({ placar: { total: 0 } })
    const req = criarRequisicao()
    const res = criarResposta()

    await sprintsController[acao](req, res)

    expect(m.RepositorioTarefas).toHaveBeenCalledWith(req.supabase)
    expect(m.ObterPlacar).toHaveBeenCalledWith(expect.objectContaining({ execute: m.execute }), m.RepositorioTarefas.mock.results[0]!.value)
    expect(m.executePlacar).toHaveBeenCalledWith(USUARIO.id, alvo)
    expect(res.json).toHaveBeenCalledWith({ placar: { total: 0 } })
  })

  it('adicionarTarefa: compõe tarefa e sprint com o client da requisição e responde 201', async () => {
    m.executeAdicionar.mockResolvedValue({ id: 't' })
    const req = criarRequisicao({ body: { tarefaId: 't', dia: '2026-11-18' } })
    const res = criarResposta()

    await sprintsController.adicionarTarefa(req, res)

    expect(m.RepositorioTarefa).toHaveBeenCalledWith(req.supabase)
    expect(m.RepositorioSprint).toHaveBeenCalledWith(req.supabase)
    expect(m.Adicionar).toHaveBeenCalledWith(m.RepositorioTarefa.mock.results[0]!.value, m.RepositorioSprint.mock.results[0]!.value)
    expect(m.executeAdicionar).toHaveBeenCalledWith(USUARIO.id, 't', '2026-11-18')
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: 't' })
  })

  it('moverTarefa: repassa o id e o novo dia', async () => {
    m.executeMover.mockResolvedValue({ id: 't' })
    const req = criarRequisicao({ params: { id: 't' }, body: { dia: '2026-11-19' } })
    const res = criarResposta()

    await sprintsController.moverTarefa(req, res)

    expect(m.Mover).toHaveBeenCalledWith(m.RepositorioTarefa.mock.results[0]!.value, m.RepositorioSprint.mock.results[0]!.value)
    expect(m.executeMover).toHaveBeenCalledWith(USUARIO.id, 't', '2026-11-19')
    expect(res.json).toHaveBeenCalledWith({ id: 't' })
  })

  it('removerTarefa: devolve a tarefa ao backlog', async () => {
    m.executeRemover.mockResolvedValue({ id: 't' })
    const req = criarRequisicao({ params: { id: 't' } })
    const res = criarResposta()

    await sprintsController.removerTarefa(req, res)

    expect(m.Remover).toHaveBeenCalledWith(m.RepositorioTarefa.mock.results[0]!.value)
    expect(m.executeRemover).toHaveBeenCalledWith(USUARIO.id, 't')
    expect(res.json).toHaveBeenCalledWith({ id: 't' })
  })

  it('propaga o erro de trava (409) sem responder', async () => {
    const erro = new Error('travada')
    m.executeRemover.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(sprintsController.removerTarefa(criarRequisicao({ params: { id: 't' } }), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })

  it.each([
    ['recompensaAtual', 'ATUAL'],
    ['recompensaProximo', 'PROXIMO'],
  ] as const)('%s: define a recompensa do sprint pelo use-case e responde o resultado', async (acao, alvo) => {
    m.executeDefinirRecompensa.mockResolvedValue({ recompensa: 'Pizza' })
    const req = criarRequisicao({ body: { recompensa: 'Pizza' } })
    const res = criarResposta()

    await sprintsController[acao](req, res)

    expect(m.RepositorioRecompensa).toHaveBeenCalledWith(req.supabase)
    expect(m.DefinirRecompensa).toHaveBeenCalledWith(
      expect.objectContaining({ execute: m.execute }),
      m.RepositorioSprint.mock.results.at(-1)!.value,
      expect.objectContaining({ repositorio: 'recompensa' }),
    )
    expect(m.executeDefinirRecompensa).toHaveBeenCalledWith(USUARIO.id, alvo, 'Pizza')
    expect(res.json).toHaveBeenCalledWith({ recompensa: 'Pizza' })
  })

  it('recompensaProximo: propaga o 409 de sprint fechado sem responder', async () => {
    const erro = new Error('fechado')
    m.executeDefinirRecompensa.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(sprintsController.recompensaProximo(criarRequisicao({ body: { recompensa: null } }), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })

  it('recompensa padrão: lê e grava com o repositório da requisição', async () => {
    m.executeObterPadrao.mockResolvedValue({ recompensaPadrao: 'Cinema' })
    m.executeDefinirPadrao.mockResolvedValue({ recompensaPadrao: 'Pizza' })
    const res = criarResposta()
    const resGravar = criarResposta()

    await sprintsController.obterRecompensaPadrao(criarRequisicao(), res)
    await sprintsController.definirRecompensaPadrao(criarRequisicao({ body: { recompensaPadrao: 'Pizza' } }), resGravar)

    expect(m.executeObterPadrao).toHaveBeenCalledWith(USUARIO.id)
    expect(res.json).toHaveBeenCalledWith({ recompensaPadrao: 'Cinema' })
    expect(m.executeDefinirPadrao).toHaveBeenCalledWith(USUARIO.id, 'Pizza')
    expect(resGravar.json).toHaveBeenCalledWith({ recompensaPadrao: 'Pizza' })
  })

  it('historico: repassa page e pageSize já validados', async () => {
    m.executeHistorico.mockResolvedValue({ items: [] })
    const req = criarRequisicao({ query: { page: 2, pageSize: 5 } as never })
    const res = criarResposta()

    await sprintsController.historico(req, res)

    expect(m.Historico).toHaveBeenCalledWith(m.RepositorioSprint.mock.results.at(-1)!.value)
    expect(m.executeHistorico).toHaveBeenCalledWith(USUARIO.id, 2, 5)
    expect(res.json).toHaveBeenCalledWith({ items: [] })
  })
})
