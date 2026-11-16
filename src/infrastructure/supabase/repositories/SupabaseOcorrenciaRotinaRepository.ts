import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { OcorrenciaPlanejada, OcorrenciaRotina } from '../../../domain/entities/OcorrenciaRotina'
import type { OcorrenciaRotinaRepository } from '../../../domain/repositories/OcorrenciaRotinaRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

type OcorrenciaRow = Database['public']['Tables']['ocorrencias_rotina']['Row']

function paraOcorrencia(row: OcorrenciaRow): OcorrenciaRotina {
  return {
    id: row.id,
    sprintId: row.sprint_id,
    itemId: row.item_id,
    nome: row.nome,
    data: row.data,
    hora: row.hora,
    indice: row.indice,
    ordem: row.ordem,
    lembrete: row.lembrete,
    concluidaEm: row.concluida_em,
  }
}

function paraLinha(userId: ID, sprintId: ID, o: OcorrenciaPlanejada, lembrete: boolean) {
  return {
    user_id: userId,
    sprint_id: sprintId,
    item_id: o.itemId,
    nome: o.nome,
    data: o.data,
    hora: o.hora,
    indice: o.indice,
    ordem: o.ordem,
    lembrete,
  }
}

export class SupabaseOcorrenciaRotinaRepository implements OcorrenciaRotinaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listarDoSprint(userId: ID, sprintId: ID): Promise<OcorrenciaRotina[]> {
    const { data, error } = await this.supabase
      .from('ocorrencias_rotina')
      .select('*')
      .eq('sprint_id', sprintId)
      .eq('user_id', userId)
      .order('ordem', { ascending: true })

    if (error) throw error
    return data.map(paraOcorrencia)
  }

  async buscarPorId(userId: ID, id: ID): Promise<OcorrenciaRotina | null> {
    const { data, error } = await this.supabase
      .from('ocorrencias_rotina')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? paraOcorrencia(data) : null
  }

  async concluir(userId: ID, id: ID, concluidaEm: string): Promise<OcorrenciaRotina> {
    const { data, error } = await this.supabase
      .from('ocorrencias_rotina')
      .update({ concluida_em: concluidaEm })
      .eq('id', id)
      .eq('user_id', userId)
      .is('concluida_em', null)
      .select('*')
      .maybeSingle()

    if (error) throw error
    // Sem linha: já concluída por outra requisição ou removida; a conclusão original prevalece.
    if (!data) {
      const atual = await this.buscarPorId(userId, id)
      if (!atual) throw new NotFoundError('Ocorrência')
      return atual
    }
    return paraOcorrencia(data)
  }

  async inserirVarias(
    userId: ID,
    sprintId: ID,
    ocorrencias: OcorrenciaPlanejada[],
    lembretes: OcorrenciaPlanejada[],
  ): Promise<void> {
    const linhas = [
      ...ocorrencias.map((o) => paraLinha(userId, sprintId, o, false)),
      ...lembretes.map((o) => paraLinha(userId, sprintId, o, true)),
    ]
    if (linhas.length === 0) return

    const { error } = await this.supabase
      .from('ocorrencias_rotina')
      .upsert(linhas, { onConflict: 'sprint_id,item_id,data,indice', ignoreDuplicates: true })

    if (error) throw error
  }
}
