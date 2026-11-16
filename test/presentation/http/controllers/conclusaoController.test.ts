import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sprintsController } from '../../../../src/presentation/http/controllers/sprintsController'
import { tarefasController } from '../../../../src/presentation/http/controllers/tarefasController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => ({
  RepositorioTarefa: vi.fn(function (client: unknown) { return { repositorio: 'tarefa', client } }),
  RepositorioSprint: vi.fn(function (client: unknown) { return { repositorio: 'sprint', client } }),
  RepositorioOcorrencia: vi.fn(function (client: unknown) { return { repositorio: 'ocorrencias', client } }),
  executeConcluirTarefa: vi.fn(),
  executeDesmarcar: vi.fn(),
  executeConcluirOcorrencia: vi.fn(),
  ConcluirTarefa: vi.fn(),
  DesmarcarConclusaoTarefa: vi.fn(),
  ConcluirOcorrenciaRotina: vi.fn(),
}))

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseTarefaRepository', () => ({ SupabaseTarefaRepository: m.RepositorioTarefa }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseSprintRepository', () => ({ SupabaseSprintRepository: m.RepositorioSprint }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository', () => ({ SupabaseOcorrenciaRotinaRepository: m.RepositorioOcorrencia }))
vi.mock('../../../../src/application/use-cases/tarefas/ConcluirTarefa', () => ({ ConcluirTarefa: m.ConcluirTarefa }))
vi.mock('../../../../src/application/use-cases/tarefas/DesmarcarConclusaoTarefa', () => ({ DesmarcarConclusaoTarefa: m.DesmarcarConclusaoTarefa }))
vi.mock('../../../../src/application/use-cases/sprints/ConcluirOcorrenciaRotina', () => ({ ConcluirOcorrenciaRotina: m.ConcluirOcorrenciaRotina }))

describe('controllers de conclusão', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.ConcluirTarefa.mockImplementation(function () { return { execute: m.executeConcluirTarefa } })
    m.DesmarcarConclusaoTarefa.mockImplementation(function () { return { execute: m.executeDesmarcar } })
    m.ConcluirOcorrenciaRotina.mockImplementation(function () { return { execute: m.executeConcluirOcorrencia } })
  })

  it('tarefas.concluir: compõe repositórios com o client da requisição e responde a tarefa', async () => {
    m.executeConcluirTarefa.mockResolvedValue({ id: 't', concluida: true })
    const req = criarRequisicao({ params: { id: 't' } })
    const res = criarResposta()

    await tarefasController.concluir(req, res)

    expect(m.RepositorioTarefa).toHaveBeenCalledWith(req.supabase)
    expect(m.RepositorioSprint).toHaveBeenCalledWith(req.supabase)
    expect(m.ConcluirTarefa).toHaveBeenCalledWith(m.RepositorioTarefa.mock.results[0]!.value, m.RepositorioSprint.mock.results[0]!.value)
    expect(m.executeConcluirTarefa).toHaveBeenCalledWith(USUARIO.id, 't')
    expect(res.json).toHaveBeenCalledWith({ id: 't', concluida: true })
  })

  it('tarefas.concluir: propaga o erro do use-case sem responder', async () => {
    const erro = new Error('falha')
    m.executeConcluirTarefa.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(tarefasController.concluir(criarRequisicao({ params: { id: 't' } }), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })

  it('tarefas.desmarcarConclusao: usa o repositório da requisição e propaga a recusa sem responder', async () => {
    const erro = new Error('definitiva')
    m.executeDesmarcar.mockRejectedValue(erro)
    const req = criarRequisicao({ params: { id: 't' } })
    const res = criarResposta()

    await expect(tarefasController.desmarcarConclusao(req, res)).rejects.toBe(erro)

    expect(m.DesmarcarConclusaoTarefa).toHaveBeenCalledWith(m.RepositorioTarefa.mock.results[0]!.value)
    expect(m.executeDesmarcar).toHaveBeenCalledWith(USUARIO.id, 't')
    expect(res.json).not.toHaveBeenCalled()
    expect(res.send).not.toHaveBeenCalled()
  })

  it('sprints.concluirOcorrencia: compõe o repositório com o client da requisição e responde a ocorrência', async () => {
    m.executeConcluirOcorrencia.mockResolvedValue({ id: 'o', concluidaEm: '2026-11-16T15:00:00.000Z' })
    const req = criarRequisicao({ params: { id: 'o' } })
    const res = criarResposta()

    await sprintsController.concluirOcorrencia(req, res)

    expect(m.RepositorioOcorrencia).toHaveBeenCalledWith(req.supabase)
    expect(m.ConcluirOcorrenciaRotina).toHaveBeenCalledWith(m.RepositorioOcorrencia.mock.results[0]!.value)
    expect(m.executeConcluirOcorrencia).toHaveBeenCalledWith(USUARIO.id, 'o')
    expect(res.json).toHaveBeenCalledWith({ id: 'o', concluidaEm: '2026-11-16T15:00:00.000Z' })
  })

  it('sprints.concluirOcorrencia: propaga o erro sem responder', async () => {
    const erro = new Error('outro dia')
    m.executeConcluirOcorrencia.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(sprintsController.concluirOcorrencia(criarRequisicao({ params: { id: 'o' } }), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })
})
