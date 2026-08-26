import type { Request, Response } from 'express'

import { ListarCategorias } from '../../../application/use-cases/categorias/ListarCategorias'
import { SupabaseCategoriaRepository } from '../../../infrastructure/supabase/repositories/SupabaseCategoriaRepository'

export const categoriasController = {
  async listar(req: Request, res: Response) {
    const categoriaRepository = new SupabaseCategoriaRepository(req.supabase!)
    const listarCategorias = new ListarCategorias(categoriaRepository)

    const categorias = await listarCategorias.execute(req.usuario!.id)
    res.json(categorias)
  },
}
