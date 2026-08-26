import type { Request, Response } from 'express'

import { SupabaseAuthService } from '../../../infrastructure/auth/SupabaseAuthService'
import { AutenticarUsuario } from '../../../application/use-cases/auth/AutenticarUsuario'
import { RegistrarUsuario } from '../../../application/use-cases/auth/RegistrarUsuario'
import { RenovarSessao } from '../../../application/use-cases/auth/RenovarSessao'

const registrarUsuario = new RegistrarUsuario(SupabaseAuthService)
const autenticarUsuario = new AutenticarUsuario(SupabaseAuthService)
const renovarSessao = new RenovarSessao(SupabaseAuthService)

export const authController = {
  async registrar(req: Request, res: Response) {
    const { email, senha, nome } = req.body
    const sessao = await registrarUsuario.execute(email, senha, nome)
    res.status(201).json(sessao)
  },

  async login(req: Request, res: Response) {
    const { email, senha } = req.body
    const sessao = await autenticarUsuario.execute(email, senha)
    res.json(sessao)
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body
    const sessao = await renovarSessao.execute(refreshToken)
    res.json(sessao)
  },

  async me(req: Request, res: Response) {
    res.json(req.usuario)
  },
}
