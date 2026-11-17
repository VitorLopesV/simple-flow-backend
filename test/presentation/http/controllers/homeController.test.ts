import { beforeEach, describe, expect, it, vi } from 'vitest'

import { homeController } from '../../../../src/presentation/http/controllers/homeController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => {
  const repositorio = (nome: string) =>
    vi.fn(function (client: unknown) {
      return { repositorio: nome, client }
    })
  const execute = vi.fn()
  return {
    Sprint: repositorio('sprints'),
    Ocorrencia: repositorio('ocorrencias'),
    Item: repositorio('itens'),
    TarefasDoSprint: repositorio('tarefasDoSprint'),
    Padrao: repositorio('padrao'),
    Tarefa: repositorio('tarefa'),
    Saida: repositorio('saida'),
    Dashboard: repositorio('dashboard'),
    FecharVencidos: vi.fn(function (...args: unknown[]) {
      return { fechar: args }
    }),
    ObterSprint: vi.fn(function (...args: unknown[]) {
      return { obterSprint: args }
    }),
    ResumoDashboard: vi.fn(function (repo: unknown) {
      return { resumoDashboard: repo }
    }),
    execute,
    ResumoDaHome: vi.fn(function () {
      return { execute }
    }),
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseSprintRepository', () => ({ SupabaseSprintRepository: m.Sprint }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository', () => ({ SupabaseOcorrenciaRotinaRepository: m.Ocorrencia }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseItemRotinaRepository', () => ({ SupabaseItemRotinaRepository: m.Item }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository', () => ({ SupabaseTarefasDoSprintRepository: m.TarefasDoSprint }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseRecompensaPadraoRepository', () => ({ SupabaseRecompensaPadraoRepository: m.Padrao }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseTarefaRepository', () => ({ SupabaseTarefaRepository: m.Tarefa }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseSaidaRepository', () => ({ SupabaseSaidaRepository: m.Saida }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseDashboardRepository', () => ({ SupabaseDashboardRepository: m.Dashboard }))
vi.mock('../../../../src/application/use-cases/sprints/FecharSprintsVencidos', () => ({ FecharSprintsVencidos: m.FecharVencidos }))
vi.mock('../../../../src/application/use-cases/sprints/ObterSprint', () => ({ ObterSprint: m.ObterSprint }))
vi.mock('../../../../src/application/use-cases/dashboard/ResumoDashboard', () => ({ ResumoDashboard: m.ResumoDashboard }))
vi.mock('../../../../src/application/use-cases/home/ResumoDaHome', () => ({ ResumoDaHome: m.ResumoDaHome }))

describe('homeController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resumo: compõe os repositórios com o client da requisição e responde com o resumo do usuário', async () => {
    const resumo = { hoje: '2026-11-16' }
    m.execute.mockResolvedValue(resumo)
    const req = criarRequisicao()
    const res = criarResposta()

    await homeController.resumo(req, res)

    for (const repositorio of [m.Sprint, m.Ocorrencia, m.Item, m.TarefasDoSprint, m.Padrao, m.Tarefa, m.Saida, m.Dashboard]) {
      expect(repositorio).toHaveBeenCalledWith(req.supabase)
    }
    expect(m.FecharVencidos).toHaveBeenCalledWith(
      m.Sprint.mock.results[0]!.value,
      m.Ocorrencia.mock.results[0]!.value,
      m.TarefasDoSprint.mock.results[0]!.value,
      m.Padrao.mock.results[0]!.value,
    )
    expect(m.ObterSprint).toHaveBeenCalledWith(
      m.Sprint.mock.results[0]!.value,
      m.Ocorrencia.mock.results[0]!.value,
      m.Item.mock.results[0]!.value,
      m.FecharVencidos.mock.results[0]!.value,
      m.Padrao.mock.results[0]!.value,
    )
    expect(m.ResumoDashboard).toHaveBeenCalledWith(m.Dashboard.mock.results[0]!.value)
    expect(m.ResumoDaHome).toHaveBeenCalledWith(
      m.ObterSprint.mock.results[0]!.value,
      m.TarefasDoSprint.mock.results[0]!.value,
      m.Tarefa.mock.results[0]!.value,
      m.Saida.mock.results[0]!.value,
      m.ResumoDashboard.mock.results[0]!.value,
    )
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id)
    expect(res.json).toHaveBeenCalledWith(resumo)
  })

  it('resumo: propaga o erro do use-case sem responder', async () => {
    const erro = new Error('falha')
    m.execute.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(homeController.resumo(criarRequisicao(), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })
})
