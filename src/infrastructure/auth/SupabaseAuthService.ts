import type { Session, User } from '@supabase/supabase-js'

import { UnauthorizedError, ValidationError } from '../../domain/errors/DomainError'
import type { SessaoUsuario } from '../../domain/entities/Usuario'
import type { UsuarioAutenticado } from '../../shared/types/common'
import { SupabasePerfilRepository } from '../supabase/repositories/SupabasePerfilRepository'
import { supabaseAdminClient } from '../supabase/supabaseAdminClient'
import { supabaseAnonClient, supabaseClientForRequest } from '../supabase/supabaseClientForRequest'

function paraUsuarioAutenticado(user: User): UsuarioAutenticado {
  return {
    id: user.id,
    email: user.email ?? '',
    nome: (user.user_metadata?.nome as string | undefined) ?? null,
  }
}

/**
 * Sessão devolvida ao frontend, com nome/telefone/foto vindos de `profiles` (fonte
 * de verdade do perfil, editável via PATCH /auth/me) — o nome em user_metadata só
 * vale como fallback, porque não é atualizado quando o perfil muda. A leitura usa um
 * client escopado no token recém-emitido, então o RLS de `profiles` se aplica.
 */
async function montarSessao(user: User, session: Session): Promise<SessaoUsuario> {
  const perfil = await new SupabasePerfilRepository(supabaseClientForRequest(session.access_token)).buscar(user.id)
  const autenticado = paraUsuarioAutenticado(user)

  return {
    usuario: {
      ...autenticado,
      nome: perfil?.nome ?? autenticado.nome,
      telefone: perfil?.telefone ?? null,
      fotoUrl: perfil?.fotoUrl ?? null,
    },
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
  }
}

/**
 * Único ponto do backend que fala com o Supabase Auth. O client admin (service role)
 * só é usado aqui para criar usuários — nunca nos repositórios de dados.
 */
export const SupabaseAuthService = {
  async registrar(email: string, senha: string, nome?: string, telefone?: string | null): Promise<SessaoUsuario> {
    // nome/telefone vão no metadata só para o trigger `handle_new_user` criar o
    // profile já preenchido — dali em diante a fonte é `profiles`.
    const metadados = { ...(nome ? { nome } : {}), ...(telefone ? { telefone } : {}) }

    const { data: criado, error: erroCriacao } = await supabaseAdminClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: Object.keys(metadados).length > 0 ? metadados : undefined,
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

    return montarSessao(data.user, data.session)
  },

  async renovar(refreshToken: string): Promise<SessaoUsuario> {
    const { data, error } = await supabaseAnonClient().auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session || !data.user) {
      throw new UnauthorizedError('Sessão expirada. Faça login novamente.')
    }

    return montarSessao(data.user, data.session)
  },

  async obterUsuarioPorToken(accessToken: string): Promise<UsuarioAutenticado> {
    const { data, error } = await supabaseAnonClient().auth.getUser(accessToken)

    if (error || !data.user) {
      throw new UnauthorizedError('Token inválido ou expirado.')
    }

    return paraUsuarioAutenticado(data.user)
  },
}
