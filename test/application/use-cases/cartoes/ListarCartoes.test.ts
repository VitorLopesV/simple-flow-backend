import { describe, expect, it } from 'vitest'

import { ListarCartoes } from '../../../../src/application/use-cases/cartoes/ListarCartoes'
import { criarCartaoRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'

describe('ListarCartoes', () => {
  it('lista os cartões do usuário', async () => {
    const cartoes = [{ id: 'cartao-1' }, { id: 'cartao-2' }]
    const repositorio = criarCartaoRepositoryFake()
    repositorio.listar.mockResolvedValue(cartoes)

    await expect(new ListarCartoes(repositorio).execute(USER_ID)).resolves.toBe(cartoes)

    expect(repositorio.listar).toHaveBeenCalledWith(USER_ID)
  })

  it('devolve lista vazia quando o usuário não tem cartões', async () => {
    const repositorio = criarCartaoRepositoryFake()
    repositorio.listar.mockResolvedValue([])

    await expect(new ListarCartoes(repositorio).execute(USER_ID)).resolves.toEqual([])
  })

  it('propaga o erro do repositório', async () => {
    const erro = new Error('falha no banco')
    const repositorio = criarCartaoRepositoryFake()
    repositorio.listar.mockRejectedValue(erro)

    await expect(new ListarCartoes(repositorio).execute(USER_ID)).rejects.toBe(erro)
  })
})
