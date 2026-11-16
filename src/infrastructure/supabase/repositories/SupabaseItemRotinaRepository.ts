import type { SupabaseClient } from '@supabase/supabase-js'

import type { DiaUtil, ItemRotina, ItemRotinaPayload, Repeticao, VezNoDia } from '../../../domain/entities/ItemRotina'
import { NotFoundError } from '../../../domain/errors/DomainError'
import type { ItemRotinaRepository } from '../../../domain/repositories/ItemRotinaRepository'
import type { ID } from '../../../shared/types/common'
import type { Database, Json } from '../database.types'

type ItemRotinaRow = Database['public']['Tables']['itens_rotina']['Row']

function paraRepeticao(row: ItemRotinaRow): Repeticao {
  if (row.modo === 'DIAS_DA_SEMANA') return { modo: 'DIAS_DA_SEMANA', dias: (row.dias_semana ?? []) as DiaUtil[] }
  return { modo: 'A_CADA_N_DIAS', intervalo: row.intervalo_dias!, dataInicial: row.data_inicial! }
}

function paraItemRotina(row: ItemRotinaRow): ItemRotina {
  return {
    id: row.id,
    areaId: row.area_id,
    nome: row.nome,
    repeticao: paraRepeticao(row),
    vezes: row.vezes as unknown as VezNoDia[],
    criadoEm: row.criado_em,
  }
}

/** Colunas do modo que não vale ficam nulas (a constraint `itens_rotina_regra_check` exige). */
function paraLinha(payload: ItemRotinaPayload) {
  const { repeticao } = payload
  return {
    nome: payload.nome,
    modo: repeticao.modo,
    dias_semana: repeticao.modo === 'DIAS_DA_SEMANA' ? repeticao.dias : null,
    intervalo_dias: repeticao.modo === 'A_CADA_N_DIAS' ? repeticao.intervalo : null,
    data_inicial: repeticao.modo === 'A_CADA_N_DIAS' ? repeticao.dataInicial : null,
    vezes: payload.vezes as unknown as Json,
  }
}

export class SupabaseItemRotinaRepository implements ItemRotinaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listar(userId: ID): Promise<ItemRotina[]> {
    const { data, error } = await this.supabase
      .from('itens_rotina')
      .select('*')
      .eq('user_id', userId)
      .order('nome', { ascending: true })

    if (error) throw error
    return data.map(paraItemRotina)
  }

  async buscarPorId(userId: ID, id: ID): Promise<ItemRotina | null> {
    const { data, error } = await this.supabase
      .from('itens_rotina')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? paraItemRotina(data) : null
  }

  async criar(userId: ID, areaId: ID, payload: ItemRotinaPayload): Promise<ItemRotina> {
    const { data, error } = await this.supabase
      .from('itens_rotina')
      .insert({ ...paraLinha(payload), area_id: areaId, user_id: userId })
      .select('*')
      .single()

    if (error) throw error
    return paraItemRotina(data)
  }

  async atualizar(userId: ID, id: ID, payload: ItemRotinaPayload): Promise<ItemRotina> {
    const { data, error } = await this.supabase
      .from('itens_rotina')
      .update(paraLinha(payload))
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Item de rotina')
    return paraItemRotina(data)
  }

  async remover(userId: ID, id: ID): Promise<void> {
    const { data, error } = await this.supabase
      .from('itens_rotina')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')

    if (error) throw error
    if (data.length === 0) throw new NotFoundError('Item de rotina')
  }
}
