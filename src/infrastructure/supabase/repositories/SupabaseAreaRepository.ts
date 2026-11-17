import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Area, AreaPayload } from '../../../domain/entities/Area'
import type { AreaRepository } from '../../../domain/repositories/AreaRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

type AreaRow = Database['public']['Tables']['areas']['Row']

function paraArea(row: AreaRow): Area {
  return {
    id: row.id,
    nome: row.nome,
    cor: row.cor,
    sistema: row.sistema,
    criadoEm: row.criado_em,
  }
}

/**
 * A tabela `tarefas` chega na issue #64; até lá ela não existe e a área não tem como ter
 * tarefas. PGRST205 (fora do cache do PostgREST) e 42P01 (tabela inexistente) valem "sem tarefas".
 */
function tabelaTarefasAusente(error: PostgrestError): boolean {
  return error.code === 'PGRST205' || error.code === '42P01'
}

export class SupabaseAreaRepository implements AreaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /** `tarefas` ainda não está nos tipos gerados (issue #64): usa o client sem tipagem de tabela. */
  private get tarefas() {
    return (this.supabase as unknown as SupabaseClient).from('tarefas')
  }

  async listar(userId: ID): Promise<Area[]> {
    const { data, error } = await this.supabase
      .from('areas')
      .select('*')
      .eq('user_id', userId)
      .order('sistema', { ascending: false })
      .order('nome', { ascending: true })

    if (error) throw error
    return data.map(paraArea)
  }

  async buscarPorId(userId: ID, id: ID): Promise<Area | null> {
    const { data, error } = await this.supabase
      .from('areas')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? paraArea(data) : null
  }

  async buscarPorNome(userId: ID, nome: string): Promise<Area | null> {
    // ilike sem curingas = comparação sem diferenciar maiúsculas; escapa % e _ do nome.
    const { data, error } = await this.supabase
      .from('areas')
      .select('*')
      .eq('user_id', userId)
      .ilike('nome', nome.trim().replace(/[\\%_]/g, '\\$&'))
      .maybeSingle()

    if (error) throw error
    return data ? paraArea(data) : null
  }

  async criar(userId: ID, payload: AreaPayload): Promise<Area> {
    const { data, error } = await this.supabase
      .from('areas')
      .insert({ nome: payload.nome, cor: payload.cor, user_id: userId })
      .select('*')
      .single()

    if (error) throw error
    return paraArea(data)
  }

  async atualizar(userId: ID, id: ID, payload: AreaPayload): Promise<Area> {
    const { data, error } = await this.supabase
      .from('areas')
      .update({ nome: payload.nome, cor: payload.cor })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Área')
    return paraArea(data)
  }

  async remover(userId: ID, id: ID): Promise<void> {
    const { data, error } = await this.supabase
      .from('areas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')

    if (error) throw error
    if (data.length === 0) throw new NotFoundError('Área')
  }

  async contarTarefas(userId: ID, areaId: ID): Promise<number> {
    const { count, error } = await this.tarefas
      .select('id', { count: 'exact', head: true })
      .eq('area_id', areaId)
      .eq('user_id', userId)

    if (error) {
      if (tabelaTarefasAusente(error)) return 0
      throw error
    }

    // A Super task (#65) também fica numa área e conta: a área só sai com uma escolha explícita.
    const superTasks = await this.supabase
      .from('super_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('area_id', areaId)
      .eq('user_id', userId)

    if (superTasks.error) throw superTasks.error
    return (count ?? 0) + (superTasks.count ?? 0)
  }

  async contarTarefasNoSprintAberto(userId: ID, areaId: ID): Promise<number> {
    const { data, error } = await this.tarefas
      .select('sprint_id')
      .eq('area_id', areaId)
      .eq('user_id', userId)
      .not('sprint_id', 'is', null)

    if (error) {
      if (tabelaTarefasAusente(error)) return 0
      throw error
    }

    const porSprint = new Map<string, number>()
    for (const linha of data as { sprint_id: string }[]) {
      porSprint.set(linha.sprint_id, (porSprint.get(linha.sprint_id) ?? 0) + 1)
    }
    if (porSprint.size === 0) return 0

    // Depois do fechamento só as não concluídas saem do sprint; a concluída continua apontando para ele,
    // então é a situação do sprint que diz se a tarefa ainda está "no sprint aberto".
    const abertos = await this.supabase
      .from('sprints')
      .select('id')
      .eq('user_id', userId)
      .eq('situacao', 'ABERTO')
      .in('id', [...porSprint.keys()])

    if (abertos.error) throw abertos.error
    return abertos.data.reduce((total, sprint) => total + (porSprint.get(sprint.id) ?? 0), 0)
  }

  async moverTarefas(userId: ID, deAreaId: ID, paraAreaId: ID): Promise<void> {
    const { error } = await this.tarefas
      .update({ area_id: paraAreaId })
      .eq('area_id', deAreaId)
      .eq('user_id', userId)

    if (error) throw error

    // As filhas são tarefas da mesma área e já foram movidas acima; a Super task acompanha.
    const superTasks = await this.supabase
      .from('super_tasks')
      .update({ area_id: paraAreaId })
      .eq('area_id', deAreaId)
      .eq('user_id', userId)

    if (superTasks.error) throw superTasks.error
  }

  async removerTarefas(userId: ID, areaId: ID): Promise<void> {
    const { error } = await this.tarefas.delete().eq('area_id', areaId).eq('user_id', userId)

    if (error) throw error

    // As filhas saíram junto com as tarefas da área; falta a própria Super task.
    const superTasks = await this.supabase.from('super_tasks').delete().eq('area_id', areaId).eq('user_id', userId)

    if (superTasks.error) throw superTasks.error
  }
}
