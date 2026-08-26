import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from '../config/env'
import type { Database } from './database.types'

/**
 * Cria um client Supabase escopado no JWT do usuário autenticado — cada query feita
 * com esse client roda como aquele usuário, então `auth.uid()` resolve corretamente
 * e o RLS do Postgres aplica o isolamento multi-tenant de verdade. É criado um por
 * requisição (nunca reaproveitado entre usuários) e injetado pelo authMiddleware.
 */
export function supabaseClientForRequest(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

/** Client anônimo (sem sessão) — usado para login e para validar tokens. */
export function supabaseAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
