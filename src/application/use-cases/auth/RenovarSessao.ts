import type { AuthService } from '../../../domain/repositories/AuthService'
import type { SessaoUsuario } from '../../../domain/entities/Usuario'

export class RenovarSessao {
  constructor(private readonly authService: AuthService) {}

  execute(refreshToken: string): Promise<SessaoUsuario> {
    return this.authService.renovar(refreshToken)
  }
}
