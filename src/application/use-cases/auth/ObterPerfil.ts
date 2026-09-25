import type { Usuario } from '../../../domain/entities/Usuario'
import type { PerfilRepository } from '../../../domain/repositories/PerfilRepository'
import type { UsuarioAutenticado } from '../../../shared/types/common'

/** Usuário autenticado (id/e-mail do token) completado com os dados do perfil. */
export class ObterPerfil {
  constructor(private readonly perfilRepository: PerfilRepository) {}

  async execute(usuario: UsuarioAutenticado): Promise<Usuario> {
    const perfil = await this.perfilRepository.buscar(usuario.id)

    return {
      id: usuario.id,
      email: usuario.email,
      nome: perfil?.nome ?? usuario.nome,
      telefone: perfil?.telefone ?? null,
      fotoUrl: perfil?.fotoUrl ?? null,
    }
  }
}
