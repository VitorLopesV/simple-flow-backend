import { describe, expect, it } from 'vitest'

import { ResumoDashboard } from '../../../../src/application/use-cases/dashboard/ResumoDashboard'
import type { DashboardResumo } from '../../../../src/domain/entities/Dashboard'
import { criarDashboardRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const PERIODO = { mes: 8, ano: 2026 }

describe('ResumoDashboard', () => {
  it('repassa userId e período ao repositório e devolve o resumo', async () => {
    const resumo = { totalEntradas: 5000, totalSaidas: 2000, saldo: 3000 } as DashboardResumo
    const repositorio = criarDashboardRepositoryFake()
    repositorio.resumo.mockResolvedValue(resumo)

    await expect(new ResumoDashboard(repositorio).execute(USER_ID, PERIODO)).resolves.toBe(resumo)

    expect(repositorio.resumo).toHaveBeenCalledWith(USER_ID, PERIODO)
  })

  it('propaga o erro do repositório', async () => {
    const erro = new Error('falha no banco')
    const repositorio = criarDashboardRepositoryFake()
    repositorio.resumo.mockRejectedValue(erro)

    await expect(new ResumoDashboard(repositorio).execute(USER_ID, PERIODO)).rejects.toBe(erro)
  })
})
