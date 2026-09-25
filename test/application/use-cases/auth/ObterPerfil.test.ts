import { describe, expect, it } from 'vitest'

import { ObterPerfil } from '../../../../src/application/use-cases/auth/ObterPerfil'
import { criarPerfilRepositoryFake } from '../../../helpers/repositoriosFake'

const AUTENTICADO = { id: 'user-1', email: 'ana@exemplo.com', nome: 'Ana (metadata)' }

describe('ObterPerfil', () => {
  it('completa o usuário do token com nome, telefone e foto do perfil', async () => {
    const repositorio = criarPerfilRepositoryFake()
    repositorio.buscar.mockResolvedValue({ nome: 'Ana Souza', telefone: '11999998888', fotoUrl: 'data:image/jpeg;base64,AAAA' })

    await expect(new ObterPerfil(repositorio).execute(AUTENTICADO)).resolves.toEqual({
      id: 'user-1',
      email: 'ana@exemplo.com',
      nome: 'Ana Souza',
      telefone: '11999998888',
      fotoUrl: 'data:image/jpeg;base64,AAAA',
    })
    expect(repositorio.buscar).toHaveBeenCalledWith('user-1')
  })

  it('usa o nome do token e telefone/foto nulos quando o perfil não existe', async () => {
    const repositorio = criarPerfilRepositoryFake()
    repositorio.buscar.mockResolvedValue(null)

    await expect(new ObterPerfil(repositorio).execute(AUTENTICADO)).resolves.toEqual({
      id: 'user-1',
      email: 'ana@exemplo.com',
      nome: 'Ana (metadata)',
      telefone: null,
      fotoUrl: null,
    })
  })

  it('propaga o erro do repositório', async () => {
    const erro = new Error('falha no banco')
    const repositorio = criarPerfilRepositoryFake()
    repositorio.buscar.mockRejectedValue(erro)

    await expect(new ObterPerfil(repositorio).execute(AUTENTICADO)).rejects.toBe(erro)
  })
})
