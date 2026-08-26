import type { AuthService } from '../../../domain/repositories/AuthService'
import type { SessaoUsuario } from '../../../domain/entities/Usuario'

export class RegistrarUsuario {
  constructor(private readonly authService: AuthService) {}

  execute(email: string, senha: string, nome?: string): Promise<SessaoUsuario> {
    return this.authService.registrar(email, senha, nome)
  }
}
