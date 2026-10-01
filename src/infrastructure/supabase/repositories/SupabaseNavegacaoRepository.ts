import type { SupabaseClient } from '@supabase/supabase-js'

import type { NavegacaoRepository } from '../../../domain/repositories/NavegacaoRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

const TABELAS_COM_DATA = ['entradas', 'saidas', 'transacoes_cartao'] as const

/**
 * Recebe um client Supabase escopado no JWT do usuário — o RLS já restringe as
 * queries ao próprio usuário; o filtro explícito por userId é defesa em profundidade.
 */
export class SupabaseNavegacaoRepository implements NavegacaoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async primeiraDataComDados(userId: ID): Promise<string | null> {
    const respostas = await Promise.all(
      TABELAS_COM_DATA.map((tabela) =>
        this.supabase
          .from(tabela)
          .select('data')
          .eq('user_id', userId)
          .order('data', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ),
    )

    const datas: string[] = []
    for (const { data, error } of respostas) {
      if (error) throw error
      if (data) datas.push(data.data)
    }
    return datas.sort()[0] ?? null
  }
}
