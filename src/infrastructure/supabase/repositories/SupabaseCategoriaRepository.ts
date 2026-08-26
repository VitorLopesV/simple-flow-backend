import type { SupabaseClient } from '@supabase/supabase-js'

import type { Categoria } from '../../../domain/entities/Categoria'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

function paraCategoria(row: Database['public']['Tables']['categorias']['Row']): Categoria {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo as Categoria['tipo'],
    movimento: row.movimento as Categoria['movimento'],
    cor: row.cor,
    userId: row.user_id,
  }
}

/**
 * Recebe um client Supabase já escopado no JWT do usuário (ver
 * infrastructure/supabase/supabaseClientForRequest.ts) — o RLS garante que só
 * retornam as categorias do sistema (user_id nulo) + as do próprio usuário;
 * o filtro explícito por userId abaixo é defesa em profundidade.
 */
export class SupabaseCategoriaRepository implements CategoriaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listar(userId: ID): Promise<Categoria[]> {
    const { data, error } = await this.supabase
      .from('categorias')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('nome', { ascending: true })

    if (error) throw error

    return data.map(paraCategoria)
  }
}
