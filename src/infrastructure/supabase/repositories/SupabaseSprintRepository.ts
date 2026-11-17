import type { SupabaseClient } from '@supabase/supabase-js'

import type { PlacarDoSprint } from '../../../domain/entities/PlacarDoSprint'
import type { Sprint, SituacaoSprint } from '../../../domain/entities/Sprint'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { ID } from '../../../shared/types/common'
import type { Database, Json } from '../database.types'

type SprintRow = Database['public']['Tables']['sprints']['Row']

function paraSprint(row: SprintRow): Sprint {
  return {
    id: row.id,
    inicio: row.inicio,
    fim: row.fim,
    situacao: row.situacao as SituacaoSprint,
    rotinaGeradaEm: row.rotina_gerada_em,
    criadoEm: row.criado_em,
    fechadoEm: row.fechado_em,
    foto: row.foto as unknown as PlacarDoSprint | null,
    fechamentoAplicadoEm: row.fechamento_aplicado_em,
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

  async listarPendentesDeFechamento(userId: ID, ateFim: string): Promise<Sprint[]> {
    const { data, error } = await this.supabase
      .from('sprints')
      .select('*')
      .eq('user_id', userId)
      .lte('fim', ateFim)
      .is('fechamento_aplicado_em', null)
      .order('inicio', { ascending: true })

    if (error) throw error
    return data.map(paraSprint)
  }

  async fechar(userId: ID, id: ID, foto: PlacarDoSprint, fechadoEm: string): Promise<boolean> {
    // `situacao = 'ABERTO'` no filtro: quem chegar depois (job, outra aba) não regrava a foto.
    const { data, error } = await this.supabase
      .from('sprints')
      .update({ situacao: 'FECHADO', foto: foto as unknown as Json, fechado_em: fechadoEm })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('situacao', 'ABERTO')
      .select('id')

    if (error) throw error
    return data.length > 0
  }

  async marcarFechamentoAplicado(userId: ID, id: ID, quando: string): Promise<void> {
    const { error } = await this.supabase
      .from('sprints')
      .update({ fechamento_aplicado_em: quando })
      .eq('id', id)
      .eq('user_id', userId)
      .is('fechamento_aplicado_em', null)

    if (error) throw error
  }
}
