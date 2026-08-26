import { createClient } from '@supabase/supabase-js'

import { env } from '../config/env'
import type { Database } from './database.types'

/**
 * Client com a service-role key — só deve ser usado dentro de SupabaseAuthService
 * (criação de usuários no Supabase Auth). Nunca usar nos repositórios de dados:
 * eles usam o client escopado por requisição (ver supabaseClientForRequest.ts),
 * que é quem garante o isolamento multi-tenant via RLS.
 */
export const supabaseAdminClient = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
