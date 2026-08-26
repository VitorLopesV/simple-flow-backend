import type { AuthService } from '../../../domain/repositories/AuthService'
import type { SessaoUsuario } from '../../../domain/entities/Usuario'

export class AutenticarUsuario {
  constructor(private readonly authService: AuthService) {}

  execute(email: string, senha: string): Promise<SessaoUsuario> {
    return this.authService.login(email, senha)
  }
}
