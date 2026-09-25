import { ValidationError } from '../../../domain/errors/DomainError'
import type { PerfilPayload, Usuario } from '../../../domain/entities/Usuario'
import type { PerfilRepository } from '../../../domain/repositories/PerfilRepository'
import type { UsuarioAutenticado } from '../../../shared/types/common'

export interface AtualizarPerfilPayload extends PerfilPayload {
  email?: string
}

/**
 * Sempre atualiza o perfil do dono do token — o id nunca vem do cliente, então não há
 * como alterar o perfil de outro usuário. O e-mail não é editável por aqui (trocar no
 * Supabase Auth exige confirmação/service role): o frontend reenvia o e-mail atual e
 * ele é aceito só se não mudou.
 */
export class AtualizarPerfil {
  constructor(private readonly perfilRepository: PerfilRepository) {}

  async execute(usuario: UsuarioAutenticado, { email, ...perfil }: AtualizarPerfilPayload): Promise<Usuario> {
    if (email !== undefined && email.trim().toLowerCase() !== usuario.email.toLowerCase()) {
      throw new ValidationError('O e-mail não pode ser alterado.')
    }

    const atualizado = await this.perfilRepository.atualizar(usuario.id, perfil)

    return { id: usuario.id, email: usuario.email, ...atualizado }
  }
}
