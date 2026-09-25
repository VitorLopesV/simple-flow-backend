import { describe, expect, it } from 'vitest'

import { ResumoSaidas } from '../../../../src/application/use-cases/saidas/ResumoSaidas'
import type { SaidaResumo } from '../../../../src/domain/entities/Saida'
import { criarSaidaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const PERIODO = { mes: 8, ano: 2026 }

describe('ResumoSaidas', () => {
  it('repassa userId e período ao repositório e devolve o resumo', async () => {
    const resumo: SaidaResumo = {
      total: 1500,
      quantidade: 2,
      media: 750,
      totalPago: 1000,
      totalPendente: 500,
      totalMesAnterior: 1200,
      porCategoria: [],
      porTipo: [{ tipo: 'CONTA', total: 1500 }],
    }
    const repositorio = criarSaidaRepositoryFake()
    repositorio.resumo.mockResolvedValue(resumo)

    await expect(new ResumoSaidas(repositorio).execute(USER_ID, PERIODO)).resolves.toBe(resumo)

    expect(repositorio.resumo).toHaveBeenCalledWith(USER_ID, PERIODO)
  })

  it('propaga o erro do repositório', async () => {
    const erro = new Error('falha no banco')
    const repositorio = criarSaidaRepositoryFake()
    repositorio.resumo.mockRejectedValue(erro)

    await expect(new ResumoSaidas(repositorio).execute(USER_ID, PERIODO)).rejects.toBe(erro)
  })
})
