import { describe, expect, it } from 'vitest'

import { AutenticarUsuario } from '../../../../src/application/use-cases/auth/AutenticarUsuario'
import type { SessaoUsuario } from '../../../../src/domain/entities/Usuario'
import { UnauthorizedError } from '../../../../src/domain/errors/DomainError'
import { criarAuthServiceFake } from '../../../helpers/repositoriosFake'

const SESSAO: SessaoUsuario = {
  usuario: { id: 'user-1', email: 'ana@exemplo.com', nome: null },
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresIn: 3600,
}

describe('AutenticarUsuario', () => {
  it('faz login com email e senha e devolve a sessão', async () => {
    const authService = criarAuthServiceFake()
    authService.login.mockResolvedValue(SESSAO)

    await expect(new AutenticarUsuario(authService).execute('ana@exemplo.com', 'segredo')).resolves.toBe(SESSAO)

    expect(authService.login).toHaveBeenCalledWith('ana@exemplo.com', 'segredo')
  })

  it('propaga o UnauthorizedError para credenciais inválidas', async () => {
    const authService = criarAuthServiceFake()
    authService.login.mockRejectedValue(new UnauthorizedError('E-mail ou senha inválidos.'))

    const promessa = new AutenticarUsuario(authService).execute('ana@exemplo.com', 'errada')

    await expect(promessa).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(promessa).rejects.toMatchObject({ status: 401 })
  })
})
