import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type {
  Dificuldade,
  FiltroTarefas,
  Prioridade,
  Tarefa,
  TarefaEdicao,
  TarefaPayload,
  TempoEstimado,
} from '../../../domain/entities/Tarefa'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import { tarefaAtrasada } from '../../../domain/services/atraso'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

type TarefaRow = Database['public']['Tables']['tarefas']['Row']

function paraTarefa(row: TarefaRow): Tarefa {
  return {
    id: row.id,
    areaId: row.area_id,
    titulo: row.titulo,
    dia: row.dia,
    // `time` do Postgres volta como HH:MM:SS; a API expõe HH:MM.
    hora: row.hora ? row.hora.slice(0, 5) : null,
    tempoEstimado: row.tempo_estimado_minutos as TempoEstimado | null,
    dificuldade: row.dificuldade as Dificuldade | null,
    prioridade: row.prioridade as Prioridade | null,
    notas: row.notas,
    sprintId: row.sprint_id,
    superTaskId: row.super_task_id,
    concluidaEm: row.concluida_em,
    concluida: row.concluida_em !== null,
    atrasada:
      row.concluida_em !== null &&
      tarefaAtrasada(
        { dia: row.dia, hora: row.hora, tempoEstimado: row.tempo_estimado_minutos },
        new Date(row.concluida_em),
      ),
    arquivada: row.arquivada_em !== null,
    arquivadaEm: row.arquivada_em,
    criadoEm: row.criado_em,
  }
}

function paraLinha(edicao: TarefaEdicao) {
  return {
    titulo: edicao.titulo,
    dia: edicao.dia,
    hora: edicao.hora,
    tempo_estimado_minutos: edicao.tempoEstimado,
    dificuldade: edicao.dificuldade,
    prioridade: edicao.prioridade,
    notas: edicao.notas,
  }
}

export class SupabaseTarefaRepository implements TarefaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listar(userId: ID, filtro: FiltroTarefas): Promise<Tarefa[]> {
    let query = this.supabase.from('tarefas').select('*').eq('user_id', userId)
    if (filtro.areaId) query = query.eq('area_id', filtro.areaId)
    if (!filtro.incluirArquivadas) query = query.is('arquivada_em', null)

    const { data, error } = await query.order('criado_em', { ascending: false })

    if (error) throw error
    return data.map(paraTarefa)
  }

  async buscarPorId(userId: ID, id: ID): Promise<Tarefa | null> {
    const { data, error } = await this.supabase
      .from('tarefas')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? paraTarefa(data) : null
  }

  async criar(userId: ID, payload: TarefaPayload, sprintId?: ID): Promise<Tarefa> {
    const { data, error } = await this.supabase
      .from('tarefas')
      .insert({ ...paraLinha(payload), area_id: payload.areaId, user_id: userId, sprint_id: sprintId ?? null })
      .select('*')
      .single()

    if (error) throw error
    return paraTarefa(data)
  }

  async atualizar(userId: ID, id: ID, edicao: TarefaEdicao, sprintId?: ID | null): Promise<Tarefa> {
    return this.alterar(userId, id, sprintId === undefined ? paraLinha(edicao) : { ...paraLinha(edicao), sprint_id: sprintId })
  }

  async definirSprint(userId: ID, id: ID, vinculo: { sprintId: ID | null; dia?: string }): Promise<Tarefa> {
    return this.alterar(userId, id, {
      sprint_id: vinculo.sprintId,
      ...(vinculo.dia === undefined ? {} : { dia: vinculo.dia }),
    })
  }

  async concluir(userId: ID, id: ID, concluidaEm: string): Promise<Tarefa> {
    const { data, error } = await this.supabase
      .from('tarefas')
      .update({ concluida_em: concluidaEm })
      .eq('id', id)
      .eq('user_id', userId)
      .is('concluida_em', null)
      .select('*')
      .maybeSingle()

    if (error) throw error
    // Sem linha: já concluída (por outra requisição) ou removida; a conclusão original prevalece.
    if (!data) {
      const atual = await this.buscarPorId(userId, id)
      if (!atual) throw new NotFoundError('Tarefa')
      return atual
    }
    return paraTarefa(data)
  }

  async mover(userId: ID, id: ID, areaId: ID): Promise<Tarefa> {
    return this.alterar(userId, id, { area_id: areaId })
  }

  async definirArquivamento(userId: ID, id: ID, arquivadaEm: string | null): Promise<Tarefa> {
    return this.alterar(userId, id, { arquivada_em: arquivadaEm })
  }

  async remover(userId: ID, id: ID): Promise<void> {
    const { data, error } = await this.supabase
      .from('tarefas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')

    if (error) throw error
    if (data.length === 0) throw new NotFoundError('Tarefa')
  }

  async listarDasSuperTasks(userId: ID, superTaskIds: ID[]): Promise<Tarefa[]> {
    if (superTaskIds.length === 0) return []
    const { data, error } = await this.supabase
      .from('tarefas')
      .select('*')
      .eq('user_id', userId)
      .in('super_task_id', superTaskIds)
      .order('criado_em', { ascending: true })

    if (error) throw error
    return data.map(paraTarefa)
  }

  async definirSuperTask(userId: ID, id: ID, superTaskId: ID | null): Promise<Tarefa> {
    return this.alterar(userId, id, { super_task_id: superTaskId })
  }

  async moverDaSuperTask(userId: ID, superTaskId: ID, areaId: ID): Promise<void> {
    const { error } = await this.supabase
      .from('tarefas')
      .update({ area_id: areaId })
      .eq('super_task_id', superTaskId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async soltarDaSuperTask(userId: ID, superTaskId: ID): Promise<void> {
    const { error } = await this.supabase
      .from('tarefas')
      .update({ super_task_id: null })
      .eq('super_task_id', superTaskId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async removerDaSuperTask(userId: ID, superTaskId: ID): Promise<void> {
    const { error } = await this.supabase.from('tarefas').delete().eq('super_task_id', superTaskId).eq('user_id', userId)

    if (error) throw error
  }

  private async alterar(
    userId: ID,
    id: ID,
    linha: Database['public']['Tables']['tarefas']['Update'],
  ): Promise<Tarefa> {
    const { data, error } = await this.supabase
      .from('tarefas')
      .update(linha)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Tarefa')
    return paraTarefa(data)
  }
}
