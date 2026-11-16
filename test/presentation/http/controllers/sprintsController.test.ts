import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sprintsController } from '../../../../src/presentation/http/controllers/sprintsController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => ({
  RepositorioSprint: vi.fn(function (client: unknown) { return { repositorio: 'sprints', client } }),
  RepositorioOcorrencia: vi.fn(function (client: unknown) { return { repositorio: 'ocorrencias', client } }),
  RepositorioItem: vi.fn(function (client: unknown) { return { repositorio: 'itens', client } }),
  execute: vi.fn(),
  ObterSprint: vi.fn(),
}))

vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseSprintRepository', () => ({ SupabaseSprintRepository: m.RepositorioSprint }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository', () => ({ SupabaseOcorrenciaRotinaRepository: m.RepositorioOcorrencia }))
vi.mock('../../../../src/infrastructure/supabase/repositories/SupabaseItemRotinaRepository', () => ({ SupabaseItemRotinaRepository: m.RepositorioItem }))
vi.mock('../../../../src/application/use-cases/sprints/ObterSprint', () => ({ ObterSprint: m.ObterSprint }))

describe('sprintsController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.ObterSprint.mockImplementation(function () { return { execute: m.execute } })
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
    )
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
})
