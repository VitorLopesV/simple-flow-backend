import { describe, expect, it } from 'vitest'

import { ListarEntradas } from '../../../../src/application/use-cases/entradas/ListarEntradas'
import type { EntradaFiltro } from '../../../../src/domain/repositories/EntradaRepository'
import { criarEntradaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const FILTRO: EntradaFiltro = { periodo: { mes: 8, ano: 2026 }, categoriaId: 'cat-1', busca: 'sal', page: 2, pageSize: 10 }

describe('ListarEntradas', () => {
  it('repassa userId e filtro ao repositório e devolve a página', async () => {
    const pagina = { items: [], page: 2, pageSize: 10, total: 0, totalPages: 1 }
    const repositorio = criarEntradaRepositoryFake()
    repositorio.listar.mockResolvedValue(pagina)

    await expect(new ListarEntradas(repositorio).execute(USER_ID, FILTRO)).resolves.toBe(pagina)

    expect(repositorio.listar).toHaveBeenCalledWith(USER_ID, FILTRO)
  })

  it('propaga o erro do repositório', async () => {
    const erro = new Error('falha no banco')
    const repositorio = criarEntradaRepositoryFake()
    repositorio.listar.mockRejectedValue(erro)

    await expect(new ListarEntradas(repositorio).execute(USER_ID, FILTRO)).rejects.toBe(erro)
  })
})
