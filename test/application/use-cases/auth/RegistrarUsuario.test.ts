import { describe, expect, it } from 'vitest'

import { RegistrarUsuario } from '../../../../src/application/use-cases/auth/RegistrarUsuario'
import type { SessaoUsuario } from '../../../../src/domain/entities/Usuario'
import { ValidationError } from '../../../../src/domain/errors/DomainError'
import { criarAuthServiceFake } from '../../../helpers/repositoriosFake'

const SESSAO: SessaoUsuario = {
  usuario: { id: 'user-1', email: 'ana@exemplo.com', nome: 'Ana' },
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresIn: 3600,
}

describe('RegistrarUsuario', () => {
  it('registra com email, senha e nome e devolve a sessão', async () => {
    const authService = criarAuthServiceFake()
    authService.registrar.mockResolvedValue(SESSAO)

    await expect(new RegistrarUsuario(authService).execute('ana@exemplo.com', 'segredo', 'Ana')).resolves.toBe(SESSAO)

    expect(authService.registrar).toHaveBeenCalledWith('ana@exemplo.com', 'segredo', 'Ana')
  })

  it('registra sem nome quando ele não é informado', async () => {
    const authService = criarAuthServiceFake()
    authService.registrar.mockResolvedValue(SESSAO)

    await new RegistrarUsuario(authService).execute('ana@exemplo.com', 'segredo')

    expect(authService.registrar).toHaveBeenCalledWith('ana@exemplo.com', 'segredo', undefined)
  })

  it('propaga o ValidationError do serviço (ex.: e-mail já cadastrado)', async () => {
    const authService = criarAuthServiceFake()
    authService.registrar.mockRejectedValue(new ValidationError('User already registered'))

    const promessa = new RegistrarUsuario(authService).execute('ana@exemplo.com', 'segredo')

    await expect(promessa).rejects.toBeInstanceOf(ValidationError)
    await expect(promessa).rejects.toMatchObject({ status: 422, message: 'User already registered' })
  })
})
