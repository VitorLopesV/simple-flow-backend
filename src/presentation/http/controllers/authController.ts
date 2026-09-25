import type { Request, Response } from 'express'

import { SupabaseAuthService } from '../../../infrastructure/auth/SupabaseAuthService'
import { SupabasePerfilRepository } from '../../../infrastructure/supabase/repositories/SupabasePerfilRepository'
import { AtualizarPerfil } from '../../../application/use-cases/auth/AtualizarPerfil'
import { AutenticarUsuario } from '../../../application/use-cases/auth/AutenticarUsuario'
import { ObterPerfil } from '../../../application/use-cases/auth/ObterPerfil'
import { RegistrarUsuario } from '../../../application/use-cases/auth/RegistrarUsuario'
import { RenovarSessao } from '../../../application/use-cases/auth/RenovarSessao'

const registrarUsuario = new RegistrarUsuario(SupabaseAuthService)
const autenticarUsuario = new AutenticarUsuario(SupabaseAuthService)
const renovarSessao = new RenovarSessao(SupabaseAuthService)

export const authController = {
  async registrar(req: Request, res: Response) {
    const { email, senha, nome, telefone } = req.body
    const sessao = await registrarUsuario.execute(email, senha, nome, telefone)
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
    const perfilRepository = new SupabasePerfilRepository(req.supabase!)
    const usuario = await new ObterPerfil(perfilRepository).execute(req.usuario!)
    res.json(usuario)
  },

  async atualizarPerfil(req: Request, res: Response) {
    const perfilRepository = new SupabasePerfilRepository(req.supabase!)
    const usuario = await new AtualizarPerfil(perfilRepository).execute(req.usuario!, req.body)
    res.json(usuario)
  },
}
