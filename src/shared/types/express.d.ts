import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../infrastructure/supabase/database.types'
import type { UsuarioAutenticado } from './common'

declare global {
  namespace Express {
    interface Request {
      /** Populado pelo authMiddleware após validar o Bearer token. */
      usuario?: UsuarioAutenticado
      /** Client Supabase escopado no JWT do usuário — RLS aplica o isolamento. */
      supabase?: SupabaseClient<Database>
    }
  }
}

export {}
