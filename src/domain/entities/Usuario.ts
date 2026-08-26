import type { ID } from '../../shared/types/common'

export interface Usuario {
  id: ID
  email: string
  nome: string | null
}

export interface SessaoUsuario {
  usuario: Usuario
  accessToken: string
  refreshToken: string
  expiresIn: number
}
