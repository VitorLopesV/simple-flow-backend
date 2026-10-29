import type { Request, Response } from 'express'

import { supabaseAnonClient } from '../../../infrastructure/supabase/supabaseClientForRequest'

export const keepaliveController = {
  /**
   * O plano Free do Supabase pausa o projeto após ~7 dias sem atividade. Esta consulta
   * leve passa pelo PostgREST até o Postgres; com o client anônimo o RLS só deixa ver as
   * categorias do sistema, então não toca em dado de usuário.
   */
  async verificar(_req: Request, res: Response) {
    const { error } = await supabaseAnonClient().from('categorias').select('id').limit(1)
    if (error) throw error

    res.json({ status: 'ok' })
  },
}
