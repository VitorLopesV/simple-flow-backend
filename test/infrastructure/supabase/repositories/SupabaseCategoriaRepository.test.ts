import { describe, expect, it } from 'vitest'

import { SupabaseCategoriaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseCategoriaRepository'
import { USER_ID, type CategoriaRow } from '../../../helpers/linhasSupabase'
import { criarSupabaseFake, falha, ok } from '../../../helpers/supabaseFake'

function linhaCategoria(sobrescritas: Partial<CategoriaRow> = {}): CategoriaRow {
  return {
    id: 'cat-1',
    nome: 'Alimentação',
    tipo: 'CONTA_VARIAVEL',
    movimento: 'SAIDA',
    cor: '#f97316',
    user_id: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

describe('SupabaseCategoriaRepository', () => {
  it('lista categorias do sistema e do usuário, ordenadas por nome e mapeadas para camelCase', async () => {
    const fake = criarSupabaseFake({
      categorias: [ok([linhaCategoria(), linhaCategoria({ id: 'cat-2', nome: 'Pet', user_id: USER_ID })])],
    })

    const categorias = await new SupabaseCategoriaRepository(fake.client).listar(USER_ID)

    expect(categorias).toEqual([
      { id: 'cat-1', nome: 'Alimentação', tipo: 'CONTA_VARIAVEL', movimento: 'SAIDA', cor: '#f97316', userId: null },
      { id: 'cat-2', nome: 'Pet', tipo: 'CONTA_VARIAVEL', movimento: 'SAIDA', cor: '#f97316', userId: USER_ID },
    ])
    expect(fake.consultas[0]!.chamadas).toEqual([
      ['select', '*'],
      ['or', `user_id.is.null,user_id.eq.${USER_ID}`],
      ['order', 'nome', { ascending: true }],
    ])
  })

  it('propaga o erro do banco', async () => {
    const erro = { message: 'falha no banco' }
    const { client } = criarSupabaseFake({ categorias: [falha(erro)] })

    await expect(new SupabaseCategoriaRepository(client).listar(USER_ID)).rejects.toBe(erro)
  })
})
