import type { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../../domain/errors/DomainError'
import type { Perfil, PerfilPayload } from '../../../domain/entities/Usuario'
import type { PerfilRepository } from '../../../domain/repositories/PerfilRepository'
import type { ID } from '../../../shared/types/common'
import type { Database } from '../database.types'

type PerfilRow = Pick<Database['public']['Tables']['profiles']['Row'], 'nome' | 'telefone' | 'foto_url'>

const COLUNAS = 'nome, telefone, foto_url'

function paraPerfil(row: PerfilRow): Perfil {
  return {
    nome: row.nome,
    telefone: row.telefone,
    fotoUrl: row.foto_url,
  }
}

/** Só as colunas presentes no payload — ausente mantém o valor gravado (atualização parcial). */
function paraLinha(payload: PerfilPayload) {
  return {
    ...(payload.nome !== undefined ? { nome: payload.nome } : {}),
    ...(payload.telefone !== undefined ? { telefone: payload.telefone } : {}),
    ...(payload.fotoUrl !== undefined ? { foto_url: payload.fotoUrl } : {}),
  }
}

/**
 * Recebe um client Supabase escopado no JWT do usuário — o RLS de `profiles`
 * (`id = auth.uid()`) já restringe ao próprio perfil; o filtro explícito por id é
 * defesa em profundidade (em `profiles` a chave do dono é o próprio `id`).
 */
export class SupabasePerfilRepository implements PerfilRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async buscar(userId: ID): Promise<Perfil | null> {
    const { data, error } = await this.supabase.from('profiles').select(COLUNAS).eq('id', userId).maybeSingle()

    if (error) throw error
    return data ? paraPerfil(data) : null
  }

  async atualizar(userId: ID, payload: PerfilPayload): Promise<Perfil> {
    const linha = paraLinha(payload)

    // PATCH sem nenhum campo de perfil (ex.: só o e-mail atual) não tem o que gravar.
    if (Object.keys(linha).length === 0) {
      const atual = await this.buscar(userId)
      if (!atual) throw new NotFoundError('Perfil')
      return atual
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .update(linha)
      .eq('id', userId)
      .select(COLUNAS)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new NotFoundError('Perfil')
    return paraPerfil(data)
  }
}
