import { describe, expect, it } from 'vitest'

import { ResumoEntradas } from '../../../../src/application/use-cases/entradas/ResumoEntradas'
import type { EntradaResumo } from '../../../../src/domain/entities/Entrada'
import { criarEntradaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const PERIODO = { mes: 8, ano: 2026 }

describe('ResumoEntradas', () => {
  it('repassa userId e período ao repositório e devolve o resumo', async () => {
    const resumo: EntradaResumo = { total: 5000, quantidade: 1, media: 5000, totalMesAnterior: 4000, porCategoria: [] }
    const repositorio = criarEntradaRepositoryFake()
    repositorio.resumo.mockResolvedValue(resumo)

    await expect(new ResumoEntradas(repositorio).execute(USER_ID, PERIODO)).resolves.toBe(resumo)

    expect(repositorio.resumo).toHaveBeenCalledWith(USER_ID, PERIODO)
  })

  it('propaga o erro do repositório', async () => {
    const erro = new Error('falha no banco')
    const repositorio = criarEntradaRepositoryFake()
    repositorio.resumo.mockRejectedValue(erro)

    await expect(new ResumoEntradas(repositorio).execute(USER_ID, PERIODO)).rejects.toBe(erro)
  })
})
