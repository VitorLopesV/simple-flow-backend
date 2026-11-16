import type { SupabaseClient } from '@supabase/supabase-js'

import type { Sprint, SituacaoSprint } from '../../../domain/entities/Sprint'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

type SprintRow = Database['public']['Tables']['sprints']['Row']

function paraSprint(row: SprintRow): Sprint {
  return {
    id: row.id,
    inicio: row.inicio,
    fim: row.fim,
    situacao: row.situacao as SituacaoSprint,
    rotinaGeradaEm: row.rotina_gerada_em,
    criadoEm: row.criado_em,
  }
}

export class SupabaseSprintRepository implements SprintRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async garantir(userId: ID, inicio: string, fim: string): Promise<Sprint> {
    // O upsert que ignora duplicata deixa a criação segura contra dois acessos simultâneos
    // (unicidade por usuário e semana); a leitura seguinte devolve o sprint que ganhou.
    const { error: erroCriacao } = await this.supabase
      .from('sprints')
      .upsert({ user_id: userId, inicio, fim }, { onConflict: 'user_id,inicio', ignoreDuplicates: true })
    if (erroCriacao) throw erroCriacao

    const { data, error } = await this.supabase
      .from('sprints')
      .select('*')
      .eq('user_id', userId)
      .eq('inicio', inicio)
      .single()

    if (error) throw error
    return paraSprint(data)
  }

  async marcarRotinaGerada(userId: ID, id: ID, quando: string): Promise<void> {
    const { error } = await this.supabase
      .from('sprints')
      .update({ rotina_gerada_em: quando })
      .eq('id', id)
      .eq('user_id', userId)
      .is('rotina_gerada_em', null)

    if (error) throw error
  }
}
