import { beforeEach, describe, expect, it, vi } from 'vitest'

import { alertasController } from '../../../../src/presentation/http/controllers/alertasController'
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
    FecharVencidos: vi.fn(function (...args: unknown[]) {
      return { fechar: args }
    }),
    ObterSprint: vi.fn(function (...args: unknown[]) {
      return { obterSprint: args }
    }),
    execute,
    ObterAlertasDoSino: vi.fn(function () {
      return { execute }
    }),
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseSprintRepository', () => ({ SupabaseSprintRepository: m.Sprint }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository', () => ({ SupabaseOcorrenciaRotinaRepository: m.Ocorrencia }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseItemRotinaRepository', () => ({ SupabaseItemRotinaRepository: m.Item }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository', () => ({ SupabaseTarefasDoSprintRepository: m.TarefasDoSprint }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseRecompensaPadraoRepository', () => ({ SupabaseRecompensaPadraoRepository: m.Padrao }))
vi.mock('../../../../src/application/use-cases/sprints/FecharSprintsVencidos', () => ({ FecharSprintsVencidos: m.FecharVencidos }))
vi.mock('../../../../src/application/use-cases/sprints/ObterSprint', () => ({ ObterSprint: m.ObterSprint }))
vi.mock('../../../../src/application/use-cases/alertas/ObterAlertasDoSino', () => ({ ObterAlertasDoSino: m.ObterAlertasDoSino }))

describe('alertasController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listar: compõe os repositórios com o client da requisição e responde com os alertas do usuário', async () => {
    const alertas = { hoje: '2026-11-16', alertas: [] }
    m.execute.mockResolvedValue(alertas)
    const req = criarRequisicao()
    const res = criarResposta()

    await alertasController.listar(req, res)

    for (const repositorio of [m.Sprint, m.Ocorrencia, m.Item, m.TarefasDoSprint, m.Padrao]) {
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
    expect(m.ObterAlertasDoSino).toHaveBeenCalledWith(
      m.ObterSprint.mock.results[0]!.value,
      m.TarefasDoSprint.mock.results[0]!.value,
      m.Sprint.mock.results[0]!.value,
    )
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id)
    expect(res.json).toHaveBeenCalledWith(alertas)
  })

  it('listar: propaga o erro do use-case sem responder', async () => {
    const erro = new Error('falha')
    m.execute.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(alertasController.listar(criarRequisicao(), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })
})
