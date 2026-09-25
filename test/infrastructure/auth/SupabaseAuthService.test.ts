import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UnauthorizedError, ValidationError } from '../../../src/domain/errors/DomainError'
import { SupabaseAuthService } from '../../../src/infrastructure/auth/SupabaseAuthService'
import { criarSupabaseFake, falha, ok } from '../../helpers/supabaseFake'

const { createUser, signInWithPassword, refreshSession, getUser, supabaseAnonClient, supabaseClientForRequest } =
  vi.hoisted(() => {
    const signInWithPassword = vi.fn()
    const refreshSession = vi.fn()
    const getUser = vi.fn()
    return {
      createUser: vi.fn(),
      signInWithPassword,
      refreshSession,
      getUser,
      supabaseAnonClient: vi.fn(() => ({ auth: { signInWithPassword, refreshSession, getUser } })),
      supabaseClientForRequest: vi.fn(),
    }
  })

vi.mock('../../../src/infrastructure/supabase/supabaseAdminClient', () => ({
  supabaseAdminClient: { auth: { admin: { createUser } } },
}))

vi.mock('../../../src/infrastructure/supabase/supabaseClientForRequest', () => ({
  supabaseAnonClient,
  supabaseClientForRequest,
}))

const USUARIO_SUPABASE = { id: 'user-1', email: 'ana@exemplo.com', user_metadata: { nome: 'Ana' } }
const SESSAO_SUPABASE = { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }
const PERFIL = { nome: 'Ana Souza', telefone: '11999998888', foto_url: 'data:image/jpeg;base64,AAAA' }

const SESSAO_ESPERADA = {
  usuario: {
    id: 'user-1',
    email: 'ana@exemplo.com',
    nome: 'Ana Souza',
    telefone: '11999998888',
    fotoUrl: 'data:image/jpeg;base64,AAAA',
  },
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresIn: 3600,
}

/** `profiles` lido com o client escopado no token recém-emitido. */
function perfilNoBanco(resposta = ok(PERFIL)) {
  const fake = criarSupabaseFake({ profiles: [resposta] })
  supabaseClientForRequest.mockReturnValue(fake.client)
  return fake
}

describe('SupabaseAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createUser.mockResolvedValue({ data: { user: USUARIO_SUPABASE }, error: null })
    signInWithPassword.mockResolvedValue({ data: { user: USUARIO_SUPABASE, session: SESSAO_SUPABASE }, error: null })
    refreshSession.mockResolvedValue({ data: { user: USUARIO_SUPABASE, session: SESSAO_SUPABASE }, error: null })
    getUser.mockResolvedValue({ data: { user: USUARIO_SUPABASE }, error: null })
    perfilNoBanco()
  })

  describe('registrar', () => {
    it('cria o usuário já confirmado com nome e telefone nos metadados e devolve a sessão do login', async () => {
      const sessao = await SupabaseAuthService.registrar('ana@exemplo.com', 'segredo', 'Ana', '11999998888')

      expect(createUser).toHaveBeenCalledWith({
        email: 'ana@exemplo.com',
        password: 'segredo',
        email_confirm: true,
        user_metadata: { nome: 'Ana', telefone: '11999998888' },
      })
      expect(signInWithPassword).toHaveBeenCalledWith({ email: 'ana@exemplo.com', password: 'segredo' })
      expect(sessao).toEqual(SESSAO_ESPERADA)
    })

    it('envia só o nome quando o telefone não é informado', async () => {
      await SupabaseAuthService.registrar('ana@exemplo.com', 'segredo', 'Ana', null)

      expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ user_metadata: { nome: 'Ana' } }))
    })

    it('não envia metadados quando nem nome nem telefone são informados', async () => {
      await SupabaseAuthService.registrar('ana@exemplo.com', 'segredo')

      expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ user_metadata: undefined }))
    })

    it('lança ValidationError com a mensagem do Supabase quando a criação falha', async () => {
      createUser.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } })

      const promessa = SupabaseAuthService.registrar('ana@exemplo.com', 'segredo')

      await expect(promessa).rejects.toBeInstanceOf(ValidationError)
      await expect(promessa).rejects.toMatchObject({ message: 'User already registered', status: 422 })
      expect(signInWithPassword).not.toHaveBeenCalled()
    })

    it('lança ValidationError com mensagem padrão quando não vem usuário nem erro', async () => {
      createUser.mockResolvedValue({ data: { user: null }, error: null })

      await expect(SupabaseAuthService.registrar('ana@exemplo.com', 'segredo')).rejects.toMatchObject({
        message: 'Não foi possível criar o usuário.',
      })
    })
  })

  describe('login', () => {
    it('autentica com o client anônimo e completa o usuário com o perfil, lido como o próprio usuário', async () => {
      const fake = perfilNoBanco()

      await expect(SupabaseAuthService.login('ana@exemplo.com', 'segredo')).resolves.toEqual(SESSAO_ESPERADA)

      expect(supabaseAnonClient).toHaveBeenCalled()
      expect(supabaseClientForRequest).toHaveBeenCalledWith('access')
      expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'id', 'user-1'])
    })

    it('usa o nome do metadata e telefone/foto nulos quando o perfil não existe', async () => {
      perfilNoBanco(ok(null))

      const sessao = await SupabaseAuthService.login('ana@exemplo.com', 'segredo')

      expect(sessao.usuario).toEqual({ id: 'user-1', email: 'ana@exemplo.com', nome: 'Ana', telefone: null, fotoUrl: null })
    })

    it('usa e-mail vazio e nome nulo quando nem usuário nem perfil têm esses dados', async () => {
      perfilNoBanco(ok({ nome: null, telefone: null, foto_url: null }))
      signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-2', user_metadata: {} }, session: SESSAO_SUPABASE },
        error: null,
      })

      const sessao = await SupabaseAuthService.login('ana@exemplo.com', 'segredo')

      expect(sessao.usuario).toEqual({ id: 'user-2', email: '', nome: null, telefone: null, fotoUrl: null })
    })

    it('propaga o erro da leitura do perfil', async () => {
      const erro = { message: 'falha no banco' }
      perfilNoBanco(falha(erro))

      await expect(SupabaseAuthService.login('ana@exemplo.com', 'segredo')).rejects.toBe(erro)
    })

    it.each([
      ['erro do Supabase', { data: { user: null, session: null }, error: { message: 'Invalid login' } }],
      ['sessão ausente', { data: { user: USUARIO_SUPABASE, session: null }, error: null }],
      ['usuário ausente', { data: { user: null, session: SESSAO_SUPABASE }, error: null }],
    ])('lança UnauthorizedError genérico com %s', async (_caso, resposta) => {
      signInWithPassword.mockResolvedValue(resposta)

      const promessa = SupabaseAuthService.login('ana@exemplo.com', 'errada')

      await expect(promessa).rejects.toBeInstanceOf(UnauthorizedError)
      await expect(promessa).rejects.toMatchObject({ message: 'E-mail ou senha inválidos.' })
    })
  })

  describe('renovar', () => {
    it('renova a sessão pelo refresh token, com o perfil atualizado', async () => {
      await expect(SupabaseAuthService.renovar('refresh-antigo')).resolves.toEqual(SESSAO_ESPERADA)
      expect(refreshSession).toHaveBeenCalledWith({ refresh_token: 'refresh-antigo' })
    })

    it.each([
      ['erro do Supabase', { data: { user: null, session: null }, error: { message: 'expired' } }],
      ['sessão ausente', { data: { user: USUARIO_SUPABASE, session: null }, error: null }],
    ])('lança UnauthorizedError com %s', async (_caso, resposta) => {
      refreshSession.mockResolvedValue(resposta)

      await expect(SupabaseAuthService.renovar('refresh-antigo')).rejects.toMatchObject({
        message: 'Sessão expirada. Faça login novamente.',
        status: 401,
      })
    })
  })

  describe('obterUsuarioPorToken', () => {
    it('valida o token e devolve id, e-mail e nome, sem consultar o perfil', async () => {
      await expect(SupabaseAuthService.obterUsuarioPorToken('access')).resolves.toEqual({
        id: 'user-1',
        email: 'ana@exemplo.com',
        nome: 'Ana',
      })
      expect(getUser).toHaveBeenCalledWith('access')
      expect(supabaseClientForRequest).not.toHaveBeenCalled()
    })

    it.each([
      ['erro do Supabase', { data: { user: null }, error: { message: 'bad jwt' } }],
      ['usuário ausente', { data: { user: null }, error: null }],
    ])('lança UnauthorizedError com %s', async (_caso, resposta) => {
      getUser.mockResolvedValue(resposta)

      await expect(SupabaseAuthService.obterUsuarioPorToken('access')).rejects.toMatchObject({
        message: 'Token inválido ou expirado.',
        status: 401,
      })
    })
  })
})
