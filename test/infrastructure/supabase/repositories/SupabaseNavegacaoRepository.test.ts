import { describe, expect, it } from 'vitest'

import { SupabaseNavegacaoRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseNavegacaoRepository'
import { USER_ID } from '../../../helpers/linhasSupabase'
import { criarSupabaseFake, falha, ok } from '../../../helpers/supabaseFake'

const ERRO = { message: 'falha no banco' }

describe('SupabaseNavegacaoRepository', () => {
  it('devolve a data mais antiga entre entradas, saídas e transações de cartão', async () => {
    const { client } = criarSupabaseFake({
      entradas: [ok({ data: '2026-03-05' })],
      saidas: [ok({ data: '2026-02-10' })],
      transacoes_cartao: [ok({ data: '2026-01-20' })],
    })

    await expect(new SupabaseNavegacaoRepository(client).primeiraDataComDados(USER_ID)).resolves.toBe('2026-01-20')
  })

  it('consulta só o registro mais antigo de cada tabela, sempre filtrando por user_id', async () => {
    const fake = criarSupabaseFake()

    await new SupabaseNavegacaoRepository(fake.client).primeiraDataComDados(USER_ID)

    expect(fake.consultas.map((consulta) => consulta.tabela)).toEqual(['entradas', 'saidas', 'transacoes_cartao'])
    for (const consulta of fake.consultas) {
      expect(consulta.chamadas).toEqual([
        ['select', 'data'],
        ['eq', 'user_id', USER_ID],
        ['order', 'data', { ascending: true }],
        ['limit', 1],
        ['maybeSingle'],
      ])
    }
  })

  it('ignora tabelas sem registros e devolve null quando nenhuma tem', async () => {
    const umaSo = criarSupabaseFake({ saidas: [ok({ data: '2026-04-01' })] })
    const nenhuma = criarSupabaseFake()

    await expect(new SupabaseNavegacaoRepository(umaSo.client).primeiraDataComDados(USER_ID)).resolves.toBe('2026-04-01')
    await expect(new SupabaseNavegacaoRepository(nenhuma.client).primeiraDataComDados(USER_ID)).resolves.toBeNull()
  })

  it('propaga o erro de qualquer consulta', async () => {
    const { client } = criarSupabaseFake({ transacoes_cartao: [falha(ERRO)] })

    await expect(new SupabaseNavegacaoRepository(client).primeiraDataComDados(USER_ID)).rejects.toBe(ERRO)
  })
})
