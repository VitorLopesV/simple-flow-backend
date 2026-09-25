import type { SessaoUsuario } from '../entities/Usuario'
import type { UsuarioAutenticado } from '../../shared/types/common'

export interface AuthService {
  registrar(email: string, senha: string, nome?: string, telefone?: string | null): Promise<SessaoUsuario>
  login(email: string, senha: string): Promise<SessaoUsuario>
  renovar(refreshToken: string): Promise<SessaoUsuario>
  /** Só valida o token — não carrega o perfil, para não custar uma query extra por requisição. */
  obterUsuarioPorToken(accessToken: string): Promise<UsuarioAutenticado>
}
