import type { ID } from '../../shared/types/common'

export interface Usuario {
  id: ID
  email: string
  nome: string | null
  /** Só dígitos, DDD + número (10 ou 11). */
  telefone: string | null
  /** Data URL da imagem (ver migration `perfil_telefone_e_foto`) — serve direto em `<img src>`. */
  fotoUrl: string | null
}

/** Dados do perfil (tabela `profiles`) — fonte de nome, telefone e foto devolvidos ao frontend. */
export type Perfil = Pick<Usuario, 'nome' | 'telefone' | 'fotoUrl'>

/**
 * Atualização parcial do perfil: campo ausente mantém o valor atual; `null` em
 * `telefone`/`fotoUrl` remove o dado. O nome nunca é removido, só trocado.
 */
export interface PerfilPayload {
  nome?: string
  telefone?: string | null
  fotoUrl?: string | null
}

export interface SessaoUsuario {
  usuario: Usuario
  accessToken: string
  refreshToken: string
  expiresIn: number
}
