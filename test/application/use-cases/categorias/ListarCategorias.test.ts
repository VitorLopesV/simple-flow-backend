import { describe, expect, it } from 'vitest'

import { ListarCategorias } from '../../../../src/application/use-cases/categorias/ListarCategorias'
import type { Categoria } from '../../../../src/domain/entities/Categoria'
import { criarCategoriaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'

describe('ListarCategorias', () => {
  it('devolve as categorias do sistema e as do usuário vindas do repositório', async () => {
    const categorias: Categoria[] = [
      { id: 'cat-1', nome: 'Alimentação', tipo: 'CONTA_VARIAVEL', movimento: 'SAIDA', cor: '#f97316', userId: null },
      { id: 'cat-2', nome: 'Pet', tipo: 'CONTA_VARIAVEL', movimento: 'SAIDA', cor: '#a855f7', userId: USER_ID },
    ]
    const repositorio = criarCategoriaRepositoryFake()
    repositorio.listar.mockResolvedValue(categorias)

    await expect(new ListarCategorias(repositorio).execute(USER_ID)).resolves.toBe(categorias)

    expect(repositorio.listar).toHaveBeenCalledWith(USER_ID)
  })

  it('propaga o erro do repositório', async () => {
    const erro = new Error('falha no banco')
    const repositorio = criarCategoriaRepositoryFake()
    repositorio.listar.mockRejectedValue(erro)

    await expect(new ListarCategorias(repositorio).execute(USER_ID)).rejects.toBe(erro)
  })
})
