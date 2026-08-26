import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Cartao, CartaoPayload } from '../../../domain/entities/Cartao'
import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

type CartaoRow = Database['public']['Tables']['cartoes']['Row']

function paraCartao(row: CartaoRow): Cartao {
  return {
    id: row.id,
    nome: row.nome,
    bandeira: row.bandeira as Cartao['bandeira'],
    ultimosDigitos: row.ultimos_digitos,
    limite: Number(row.limite),
    diaFechamento: row.dia_fechamento,
    diaVencimento: row.dia_vencimento,
    cor: row.cor,
    ativo: row.ativo,
    criadoEm: row.criado_em,
  }
}

function paraLinha(payload: CartaoPayload) {
  return {
    nome: payload.nome,
    bandeira: payload.bandeira,
    ultimos_digitos: payload.ultimosDigitos,
    limite: payload.limite,
    dia_fechamento: payload.diaFechamento,
    dia_vencimento: payload.diaVencimento,
    cor: payload.cor,
    ativo: payload.ativo,
  }
}

export class SupabaseCartaoRepository implements CartaoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listar(userId: ID): Promise<Cartao[]> {
    const { data, error } = await this.supabase
      .from('cartoes')
      .select('*')
      .eq('user_id', userId)
      .order('ativo', { ascending: false })
      .order('nome', { ascending: true })

    if (error) throw error
    return data.map(paraCartao)
  }

  async buscarPorId(userId: ID, id: ID): Promise<Cartao | null> {
    const { data, error } = await this.supabase
      .from('cartoes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? paraCartao(data) : null
  }

  async criar(userId: ID, payload: CartaoPayload): Promise<Cartao> {
    const { data, error } = await this.supabase
      .from('cartoes')
      .insert({ ...paraLinha(payload), user_id: userId })
      .select('*')
      .single()

    if (error) throw error
    return paraCartao(data)
  }

  async atualizar(userId: ID, id: ID, payload: CartaoPayload): Promise<Cartao> {
    const { data, error } = await this.supabase
      .from('cartoes')
      .update(paraLinha(payload))
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Cartão')
    return paraCartao(data)
  }

  async remover(userId: ID, id: ID): Promise<void> {
    const { data, error } = await this.supabase
      .from('cartoes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Cartão')
  }
}
