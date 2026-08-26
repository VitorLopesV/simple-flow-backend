import type { User } from '@supabase/supabase-js'

import { UnauthorizedError, ValidationError } from '../../domain/errors/DomainError'
import type { SessaoUsuario, Usuario } from '../../domain/entities/Usuario'
import { supabaseAdminClient } from '../supabase/supabaseAdminClient'
import { supabaseAnonClient } from '../supabase/supabaseClientForRequest'

function paraUsuario(user: User): Usuario {
  return {
    id: user.id,
    email: user.email ?? '',
    nome: (user.user_metadata?.nome as string | undefined) ?? null,
  }
}

/**
 * Único ponto do backend que fala com o Supabase Auth. O client admin (service role)
 * só é usado aqui para criar usuários — nunca nos repositórios de dados.
 */
export const SupabaseAuthService = {
  async registrar(email: string, senha: string, nome?: string): Promise<SessaoUsuario> {
    const { data: criado, error: erroCriacao } = await supabaseAdminClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: nome ? { nome } : undefined,
    })

    if (erroCriacao || !criado.user) {
      throw new ValidationError(erroCriacao?.message ?? 'Não foi possível criar o usuário.')
    }

    // admin.createUser não devolve sessão — autentica em seguida para obter os tokens.
    return SupabaseAuthService.login(email, senha)
  },

  async login(email: string, senha: string): Promise<SessaoUsuario> {
    const { data, error } = await supabaseAnonClient().auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error || !data.session || !data.user) {
      throw new UnauthorizedError('E-mail ou senha inválidos.')
    }

    return {
      usuario: paraUsuario(data.user),
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    }
  },

  async renovar(refreshToken: string): Promise<SessaoUsuario> {
    const { data, error } = await supabaseAnonClient().auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session || !data.user) {
      throw new UnauthorizedError('Sessão expirada. Faça login novamente.')
    }

    return {
      usuario: paraUsuario(data.user),
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    }
  },

  async obterUsuarioPorToken(accessToken: string): Promise<Usuario> {
    const { data, error } = await supabaseAnonClient().auth.getUser(accessToken)

    if (error || !data.user) {
      throw new UnauthorizedError('Token inválido ou expirado.')
    }

    return paraUsuario(data.user)
  },
}
