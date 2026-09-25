import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UnauthorizedError, ValidationError } from '../../../../src/domain/errors/DomainError'
import { authController } from '../../../../src/presentation/http/controllers/authController'
import { USUARIO, criarRequisicao, criarResposta } from '../../../helpers/http'

const m = vi.hoisted(() => {
  const useCase = () => {
    const execute = vi.fn()
    return { execute, Classe: vi.fn(function () { return { execute } }) }
  }
  return {
    authService: { servico: 'SupabaseAuthService' },
    registrar: useCase(),
    autenticar: useCase(),
    renovar: useCase(),
  }
})

vi.mock('../../../../src/infrastructure/auth/SupabaseAuthService', () => ({ SupabaseAuthService: m.authService }))
vi.mock('../../../../src/application/use-cases/auth/RegistrarUsuario', () => ({ RegistrarUsuario: m.registrar.Classe }))
vi.mock('../../../../src/application/use-cases/auth/AutenticarUsuario', () => ({ AutenticarUsuario: m.autenticar.Classe }))
vi.mock('../../../../src/application/use-cases/auth/RenovarSessao', () => ({ RenovarSessao: m.renovar.Classe }))

const SESSAO = { usuario: USUARIO, accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 }

describe('authController', () => {
  it('instancia os use-cases uma única vez, no carregamento do módulo, com o SupabaseAuthService', () => {
    for (const { Classe } of [m.registrar, m.autenticar, m.renovar]) {
      expect(Classe).toHaveBeenCalledTimes(1)
      expect(Classe).toHaveBeenCalledWith(m.authService)
    }
  })

  describe('ações', () => {
    beforeEach(() => {
      for (const { execute } of [m.registrar, m.autenticar, m.renovar]) execute.mockReset()
    })

    it('registrar: repassa email, senha e nome do body e responde 201 com a sessão', async () => {
      m.registrar.execute.mockResolvedValue(SESSAO)
      const res = criarResposta()

      await authController.registrar(criarRequisicao({ body: { email: 'ana@exemplo.com', senha: 'segredo', nome: 'Ana' } }), res)

      expect(m.registrar.execute).toHaveBeenCalledWith('ana@exemplo.com', 'segredo', 'Ana')
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(SESSAO)
    })

    it('registrar: propaga o ValidationError sem responder', async () => {
      const erro = new ValidationError('E-mail já cadastrado.')
      m.registrar.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(
        authController.registrar(criarRequisicao({ body: { email: 'ana@exemplo.com', senha: 'segredo' } }), res),
      ).rejects.toBe(erro)
      expect(res.status).not.toHaveBeenCalled()
    })

    it('login: repassa email e senha do body e responde 200 com a sessão', async () => {
      m.autenticar.execute.mockResolvedValue(SESSAO)
      const res = criarResposta()

      await authController.login(criarRequisicao({ body: { email: 'ana@exemplo.com', senha: 'segredo' } }), res)

      expect(m.autenticar.execute).toHaveBeenCalledWith('ana@exemplo.com', 'segredo')
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(SESSAO)
    })

    it('login: propaga o UnauthorizedError sem responder', async () => {
      const erro = new UnauthorizedError('E-mail ou senha inválidos.')
      m.autenticar.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(authController.login(criarRequisicao({ body: { email: 'a@b.com', senha: 'x' } }), res)).rejects.toBe(erro)
      expect(res.json).not.toHaveBeenCalled()
    })

    it('refresh: repassa o refreshToken do body e responde com a nova sessão', async () => {
      m.renovar.execute.mockResolvedValue(SESSAO)
      const res = criarResposta()

      await authController.refresh(criarRequisicao({ body: { refreshToken: 'refresh-antigo' } }), res)

      expect(m.renovar.execute).toHaveBeenCalledWith('refresh-antigo')
      expect(res.json).toHaveBeenCalledWith(SESSAO)
    })

    it('refresh: propaga o UnauthorizedError sem responder', async () => {
      const erro = new UnauthorizedError('Sessão expirada. Faça login novamente.')
      m.renovar.execute.mockRejectedValue(erro)
      const res = criarResposta()

      await expect(authController.refresh(criarRequisicao({ body: { refreshToken: 'x' } }), res)).rejects.toBe(erro)
      expect(res.json).not.toHaveBeenCalled()
    })

    it('me: responde com o usuário autenticado pelo middleware', async () => {
      const res = criarResposta()

      await authController.me(criarRequisicao(), res)

      expect(res.json).toHaveBeenCalledWith(USUARIO)
    })
  })
})
