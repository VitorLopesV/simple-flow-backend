import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dashboardController } from '../../../../src/presentation/http/controllers/dashboardController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => {
  const execute = vi.fn()
  return {
    Repositorio: vi.fn(function (client: unknown) { return { repositorio: 'dashboard', client } }),
    execute,
    ResumoDashboard: vi.fn(function () { return { execute } }),
  }
})

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseDashboardRepository', () => ({
  SupabaseDashboardRepository: m.Repositorio,
}))
vi.mock('../../../../src/application/use-cases/dashboard/ResumoDashboard', () => ({
  ResumoDashboard: m.ResumoDashboard,
}))

describe('dashboardController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resumo: converte a competência em período e responde com o resumo', async () => {
    const resumo = { totalEntradas: 5000, totalSaidas: 2000, saldo: 3000 }
    m.execute.mockResolvedValue(resumo)
    const req = criarRequisicao({ query: { competencia: '2026-08' } })
    const res = criarResposta()

    await dashboardController.resumo(req, res)

    expect(m.Repositorio).toHaveBeenCalledWith(req.supabase)
    expect(m.ResumoDashboard).toHaveBeenCalledWith(m.Repositorio.mock.results[0]!.value)
    expect(m.execute).toHaveBeenCalledWith(USUARIO.id, { mes: 8, ano: 2026 })
    expect(res.json).toHaveBeenCalledWith(resumo)
  })

  it('resumo: propaga o erro do use-case sem responder', async () => {
    const erro = new Error('falha')
    m.execute.mockRejectedValue(erro)
    const res = criarResposta()

    await expect(dashboardController.resumo(criarRequisicao({ query: { competencia: '2026-08' } }), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })
})
