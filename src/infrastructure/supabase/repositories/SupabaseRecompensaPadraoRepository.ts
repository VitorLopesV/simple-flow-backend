import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { RecompensaPadraoRepository } from '../../../domain/repositories/RecompensaPadraoRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

/** Guardada em `profiles.recompensa_padrao`; a chave do dono em `profiles` é o próprio `id` (além do RLS). */
export class SupabaseRecompensaPadraoRepository implements RecompensaPadraoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async obter(userId: ID): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('recompensa_padrao')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    return data?.recompensa_padrao ?? null
  }

  async definir(userId: ID, recompensa: string | null): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ recompensa_padrao: recompensa })
      .eq('id', userId)
      .select('recompensa_padrao')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Perfil')
    return data.recompensa_padrao
  }
}
