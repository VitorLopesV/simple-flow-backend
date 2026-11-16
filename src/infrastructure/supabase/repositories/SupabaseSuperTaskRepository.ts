import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { FiltroSuperTasks, SuperTask, SuperTaskEdicao, SuperTaskPayload } from '../../../domain/entities/SuperTask'
import type { SuperTaskRepository } from '../../../domain/repositories/SuperTaskRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

type SuperTaskRow = Database['public']['Tables']['super_tasks']['Row']

function paraSuperTask(row: SuperTaskRow): SuperTask {
  return {
    id: row.id,
    areaId: row.area_id,
    titulo: row.titulo,
    notas: row.notas,
    dataTermino: row.data_termino,
    concluidaEm: row.concluida_em,
    concluida: row.concluida_em !== null,
    arquivada: row.arquivada_em !== null,
    arquivadaEm: row.arquivada_em,
    criadoEm: row.criado_em,
  }
}

function paraLinha(edicao: SuperTaskEdicao) {
  return { titulo: edicao.titulo, notas: edicao.notas, data_termino: edicao.dataTermino }
}

export class SupabaseSuperTaskRepository implements SuperTaskRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listar(userId: ID, filtro: FiltroSuperTasks): Promise<SuperTask[]> {
    let query = this.supabase.from('super_tasks').select('*').eq('user_id', userId)
    if (filtro.areaId) query = query.eq('area_id', filtro.areaId)
    if (!filtro.incluirArquivadas) query = query.is('arquivada_em', null)

    const { data, error } = await query.order('criado_em', { ascending: false })

    if (error) throw error
    return data.map(paraSuperTask)
  }

  async buscarPorId(userId: ID, id: ID): Promise<SuperTask | null> {
    const { data, error } = await this.supabase
      .from('super_tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? paraSuperTask(data) : null
  }

  async criar(userId: ID, payload: SuperTaskPayload): Promise<SuperTask> {
    const { data, error } = await this.supabase
      .from('super_tasks')
      .insert({ ...paraLinha(payload), area_id: payload.areaId, user_id: userId })
      .select('*')
      .single()

    if (error) throw error
    return paraSuperTask(data)
  }

  async atualizar(userId: ID, id: ID, edicao: SuperTaskEdicao): Promise<SuperTask> {
    return this.alterar(userId, id, paraLinha(edicao))
  }

  async mover(userId: ID, id: ID, areaId: ID): Promise<SuperTask> {
    return this.alterar(userId, id, { area_id: areaId })
  }

  async definirConclusao(userId: ID, id: ID, concluidaEm: string | null): Promise<SuperTask> {
    return this.alterar(userId, id, { concluida_em: concluidaEm })
  }

  async definirArquivamento(userId: ID, id: ID, arquivadaEm: string | null): Promise<SuperTask> {
    return this.alterar(userId, id, { arquivada_em: arquivadaEm })
  }

  async remover(userId: ID, id: ID): Promise<void> {
    const { data, error } = await this.supabase
      .from('super_tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')

    if (error) throw error
    if (data.length === 0) throw new NotFoundError('Super task')
  }

  private async alterar(
    userId: ID,
    id: ID,
    linha: Database['public']['Tables']['super_tasks']['Update'],
  ): Promise<SuperTask> {
    const { data, error } = await this.supabase
      .from('super_tasks')
      .update(linha)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Super task')
    return paraSuperTask(data)
  }
}
