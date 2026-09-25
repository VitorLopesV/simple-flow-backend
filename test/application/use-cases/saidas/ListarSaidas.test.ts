import { describe, expect, it } from 'vitest'

import { ListarSaidas } from '../../../../src/application/use-cases/saidas/ListarSaidas'
import type { SaidaFiltro } from '../../../../src/domain/repositories/SaidaRepository'
import { criarSaidaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const FILTRO: SaidaFiltro = {
  periodo: { mes: 8, ano: 2026 },
  categoriaId: 'cat-1',
  status: 'PENDENTE',
  busca: 'luz',
  page: 1,
  pageSize: 20,
}

describe('ListarSaidas', () => {
  it('repassa userId e filtro ao repositório e devolve a página', async () => {
    const pagina = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }
    const repositorio = criarSaidaRepositoryFake()
    repositorio.listar.mockResolvedValue(pagina)

    await expect(new ListarSaidas(repositorio).execute(USER_ID, FILTRO)).resolves.toBe(pagina)

    expect(repositorio.listar).toHaveBeenCalledWith(USER_ID, FILTRO)
  })

  it('propaga o erro do repositório', async () => {
    const erro = new Error('falha no banco')
    const repositorio = criarSaidaRepositoryFake()
    repositorio.listar.mockRejectedValue(erro)

    await expect(new ListarSaidas(repositorio).execute(USER_ID, FILTRO)).rejects.toBe(erro)
  })
})
