import { describe, expect, it } from 'vitest'

import { AtualizarPerfil } from '../../../../src/application/use-cases/auth/AtualizarPerfil'
import type { Perfil } from '../../../../src/domain/entities/Usuario'
import { NotFoundError, ValidationError } from '../../../../src/domain/errors/DomainError'
import { criarPerfilRepositoryFake } from '../../../helpers/repositoriosFake'

const AUTENTICADO = { id: 'user-1', email: 'ana@exemplo.com', nome: 'Ana' }
const FOTO = 'data:image/jpeg;base64,AAAA'

function repositorioQueDevolve(perfil: Perfil = { nome: 'Ana Souza', telefone: '11999998888', fotoUrl: FOTO }) {
  const repositorio = criarPerfilRepositoryFake()
  repositorio.atualizar.mockResolvedValue(perfil)
  return repositorio
}

describe('AtualizarPerfil', () => {
  it('atualiza nome, telefone e foto do dono do token e devolve o usuário completo', async () => {
    const repositorio = repositorioQueDevolve()

    const usuario = await new AtualizarPerfil(repositorio).execute(AUTENTICADO, {
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      telefone: '11999998888',
      fotoUrl: FOTO,
    })

    expect(repositorio.atualizar).toHaveBeenCalledWith('user-1', { nome: 'Ana Souza', telefone: '11999998888', fotoUrl: FOTO })
    expect(usuario).toEqual({
      id: 'user-1',
      email: 'ana@exemplo.com',
      nome: 'Ana Souza',
      telefone: '11999998888',
      fotoUrl: FOTO,
    })
  })

  it('repassa só os campos enviados (atualização parcial)', async () => {
    const repositorio = repositorioQueDevolve()

    await new AtualizarPerfil(repositorio).execute(AUTENTICADO, { telefone: '1133334444' })

    expect(repositorio.atualizar).toHaveBeenCalledWith('user-1', { telefone: '1133334444' })
  })

  it('repassa fotoUrl null para remover a foto', async () => {
    const repositorio = repositorioQueDevolve({ nome: 'Ana', telefone: null, fotoUrl: null })

    const usuario = await new AtualizarPerfil(repositorio).execute(AUTENTICADO, { fotoUrl: null })

    expect(repositorio.atualizar).toHaveBeenCalledWith('user-1', { fotoUrl: null })
    expect(usuario.fotoUrl).toBeNull()
  })

  it('aceita o e-mail atual, sem diferenciar maiúsculas nem espaços, e não o repassa ao repositório', async () => {
    const repositorio = repositorioQueDevolve()

    await new AtualizarPerfil(repositorio).execute(AUTENTICADO, { email: ' Ana@Exemplo.com ', nome: 'Ana Souza' })

    expect(repositorio.atualizar).toHaveBeenCalledWith('user-1', { nome: 'Ana Souza' })
  })

  it('lança ValidationError sem gravar nada quando o e-mail é diferente do atual', async () => {
    const repositorio = repositorioQueDevolve()

    const promessa = new AtualizarPerfil(repositorio).execute(AUTENTICADO, { email: 'outra@exemplo.com', nome: 'Ana' })

    await expect(promessa).rejects.toBeInstanceOf(ValidationError)
    await expect(promessa).rejects.toMatchObject({ status: 422, message: 'O e-mail não pode ser alterado.' })
    expect(repositorio.atualizar).not.toHaveBeenCalled()
  })

  it('usa sempre o id do usuário autenticado', async () => {
    const repositorio = repositorioQueDevolve()

    await new AtualizarPerfil(repositorio).execute(AUTENTICADO, { id: 'outro-usuario', nome: 'Invasor' } as never)

    expect(repositorio.atualizar.mock.calls[0]![0]).toBe('user-1')
  })

  it('propaga o NotFoundError do repositório', async () => {
    const repositorio = criarPerfilRepositoryFake()
    repositorio.atualizar.mockRejectedValue(new NotFoundError('Perfil'))

    await expect(new AtualizarPerfil(repositorio).execute(AUTENTICADO, { nome: 'Ana' })).rejects.toBeInstanceOf(NotFoundError)
  })
})
