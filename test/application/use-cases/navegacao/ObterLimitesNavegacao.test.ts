import { describe, expect, it } from 'vitest'

import { ObterLimitesNavegacao } from '../../../../src/application/use-cases/navegacao/ObterLimitesNavegacao'
import { criarNavegacaoRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
/** 15/09/2026 ao meio-dia em São Paulo. */
const SETEMBRO = () => new Date('2026-09-15T15:00:00.000Z')

function criar(primeiraData: string | null, agora = SETEMBRO) {
  const repositorio = criarNavegacaoRepositoryFake()
  repositorio.primeiraDataComDados.mockResolvedValue(primeiraData)
  return { repositorio, useCase: new ObterLimitesNavegacao(repositorio, agora) }
}

describe('ObterLimitesNavegacao', () => {
  it('vai do mês do primeiro registro até o mês atual + 1', async () => {
    const { repositorio, useCase } = criar('2026-01-20')

    await expect(useCase.execute(USER_ID)).resolves.toEqual({ primeiroMes: '2026-01', ultimoMes: '2026-10' })
    expect(repositorio.primeiraDataComDados).toHaveBeenCalledWith(USER_ID)
  })

  it('usuário sem dados: do mês atual ao seguinte', async () => {
    const { useCase } = criar(null)

    await expect(useCase.execute(USER_ID)).resolves.toEqual({ primeiroMes: '2026-09', ultimoMes: '2026-10' })
  })

  it('dado só no futuro não puxa o limite inferior para frente', async () => {
    const { useCase } = criar('2026-10-05')

    await expect(useCase.execute(USER_ID)).resolves.toEqual({ primeiroMes: '2026-09', ultimoMes: '2026-10' })
  })

  it('é dinâmico: na virada do mês o limite superior avança', async () => {
    const { useCase } = criar('2026-01-20', () => new Date('2026-10-01T03:00:00.000Z'))

    await expect(useCase.execute(USER_ID)).resolves.toEqual({ primeiroMes: '2026-01', ultimoMes: '2026-11' })
  })

  it('usa o mês de São Paulo, não o de UTC (21h do dia 30/09 ainda é setembro)', async () => {
    const { useCase } = criar(null, () => new Date('2026-10-01T00:30:00.000Z'))

    await expect(useCase.execute(USER_ID)).resolves.toEqual({ primeiroMes: '2026-09', ultimoMes: '2026-10' })
  })

  it('atravessa a virada do ano', async () => {
    const { useCase } = criar('2025-06-01', () => new Date('2026-12-10T15:00:00.000Z'))

    await expect(useCase.execute(USER_ID)).resolves.toEqual({ primeiroMes: '2025-06', ultimoMes: '2027-01' })
  })

  it('usa o relógio real quando nenhum é injetado', async () => {
    const repositorio = criarNavegacaoRepositoryFake()
    repositorio.primeiraDataComDados.mockResolvedValue(null)

    const { primeiroMes, ultimoMes } = await new ObterLimitesNavegacao(repositorio).execute(USER_ID)

    expect(primeiroMes).toMatch(/^\d{4}-\d{2}$/)
    expect(ultimoMes > primeiroMes).toBe(true)
  })
})
