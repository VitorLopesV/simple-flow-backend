import { describe, expect, it } from 'vitest'

import { RenovarSessao } from '../../../../src/application/use-cases/auth/RenovarSessao'
import type { SessaoUsuario } from '../../../../src/domain/entities/Usuario'
import { UnauthorizedError } from '../../../../src/domain/errors/DomainError'
import { criarAuthServiceFake } from '../../../helpers/repositoriosFake'

const SESSAO: SessaoUsuario = {
  usuario: { id: 'user-1', email: 'ana@exemplo.com', nome: 'Ana' },
  accessToken: 'access-novo',
  refreshToken: 'refresh-novo',
  expiresIn: 3600,
}

describe('RenovarSessao', () => {
  it('renova pelo refresh token e devolve a nova sessão', async () => {
    const authService = criarAuthServiceFake()
    authService.renovar.mockResolvedValue(SESSAO)

    await expect(new RenovarSessao(authService).execute('refresh-antigo')).resolves.toBe(SESSAO)

    expect(authService.renovar).toHaveBeenCalledWith('refresh-antigo')
  })

  it('propaga o UnauthorizedError para refresh token expirado', async () => {
    const authService = criarAuthServiceFake()
    authService.renovar.mockRejectedValue(new UnauthorizedError('Sessão expirada. Faça login novamente.'))

    await expect(new RenovarSessao(authService).execute('refresh-antigo')).rejects.toMatchObject({
      status: 401,
      message: 'Sessão expirada. Faça login novamente.',
    })
  })
})
