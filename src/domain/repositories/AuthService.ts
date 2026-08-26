import type { SessaoUsuario, Usuario } from '../entities/Usuario'

export interface AuthService {
  registrar(email: string, senha: string, nome?: string): Promise<SessaoUsuario>
  login(email: string, senha: string): Promise<SessaoUsuario>
  renovar(refreshToken: string): Promise<SessaoUsuario>
  obterUsuarioPorToken(accessToken: string): Promise<Usuario>
}
