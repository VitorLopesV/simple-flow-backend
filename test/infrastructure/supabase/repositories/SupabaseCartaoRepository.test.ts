import { describe, expect, it } from 'vitest'

import type { CartaoPayload } from '../../../../src/domain/entities/Cartao'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabaseCartaoRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseCartaoRepository'
import { USER_ID, linhaCartao } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok, usou } from '../../../helpers/supabaseFake'

const ID = '123e4567-e89b-12d3-a456-426614174000'
const ERRO = { message: 'falha no banco' }

const PAYLOAD: CartaoPayload = {
  nome: 'Nubank',
  bandeira: 'MASTERCARD',
  ultimosDigitos: '1234',
  limite: 5000,
  diaFechamento: 10,
  diaVencimento: 20,
  cor: '#820ad1',
  ativo: true,
}

describe('SupabaseCartaoRepository', () => {
  describe('listar', () => {
    it('lista os cartões do usuário, ativos primeiro e por nome, mapeando para camelCase', async () => {
      const fake = criarSupabaseFake({ cartoes: [ok([linhaCartao({ limite: '2500.50' as unknown as number })])] })

      const cartoes = await new SupabaseCartaoRepository(fake.client).listar(USER_ID)

      expect(cartoes).toEqual([
        {
          id: 'cartao-1',
          nome: 'Nubank',
          bandeira: 'MASTERCARD',
          ultimosDigitos: '1234',
          limite: 2500.5,
          diaFechamento: 10,
          diaVencimento: 20,
          cor: '#820ad1',
          ativo: true,
          criadoEm: '2026-01-01T00:00:00.000Z',
        },
      ])
      expect(fake.consultas[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'user_id', USER_ID],
        ['order', 'ativo', { ascending: false }],
        ['order', 'nome', { ascending: true }],
      ])
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ cartoes: [falha(ERRO)] })

      await expect(new SupabaseCartaoRepository(client).listar(USER_ID)).rejects.toBe(ERRO)
    })
  })

  describe('buscarPorId', () => {
    it('busca pelo id e pelo user_id', async () => {
      const fake = criarSupabaseFake({ cartoes: [ok(linhaCartao({ id: ID }))] })

      const cartao = await new SupabaseCartaoRepository(fake.client).buscarPorId(USER_ID, ID)

      expect(cartao).toMatchObject({ id: ID, ultimosDigitos: '1234' })
      expect(fake.consultas[0]!.chamadas).toEqual([
        ['select', '*'],
        ['eq', 'id', ID],
        ['eq', 'user_id', USER_ID],
        ['maybeSingle'],
      ])
    })

    it('devolve null quando não encontra', async () => {
      const { client } = criarSupabaseFake({ cartoes: [ok(null)] })

      await expect(new SupabaseCartaoRepository(client).buscarPorId(USER_ID, ID)).resolves.toBeNull()
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ cartoes: [falha(ERRO)] })

      await expect(new SupabaseCartaoRepository(client).buscarPorId(USER_ID, ID)).rejects.toBe(ERRO)
    })
  })

  describe('criar', () => {
    it('insere o payload em snake_case com o user_id', async () => {
      const fake = criarSupabaseFake({ cartoes: [ok(linhaCartao({ id: ID }))] })

      const cartao = await new SupabaseCartaoRepository(fake.client).criar(USER_ID, PAYLOAD)

      expect(cartao.id).toBe(ID)
      expect(argumentos(fake.consultas[0]!, 'insert')).toEqual([
        {
          nome: 'Nubank',
          bandeira: 'MASTERCARD',
          ultimos_digitos: '1234',
          limite: 5000,
          dia_fechamento: 10,
          dia_vencimento: 20,
          cor: '#820ad1',
          ativo: true,
          user_id: USER_ID,
        },
      ])
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ cartoes: [falha(ERRO)] })

      await expect(new SupabaseCartaoRepository(client).criar(USER_ID, PAYLOAD)).rejects.toBe(ERRO)
    })
  })

  describe('atualizar', () => {
    it('atualiza só o cartão do usuário', async () => {
      const fake = criarSupabaseFake({ cartoes: [ok(linhaCartao({ id: ID, ativo: false }))] })

      const cartao = await new SupabaseCartaoRepository(fake.client).atualizar(USER_ID, ID, { ...PAYLOAD, ativo: false })

      expect(cartao.ativo).toBe(false)
      const consulta = fake.consultas[0]!
      expect(argumentos(consulta, 'update')![0]).toMatchObject({ ativo: false, ultimos_digitos: '1234' })
      expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
      expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('lança NotFoundError quando nenhuma linha é atualizada', async () => {
      const { client } = criarSupabaseFake({ cartoes: [ok(null)] })

      await expect(new SupabaseCartaoRepository(client).atualizar(USER_ID, ID, PAYLOAD)).rejects.toBeInstanceOf(NotFoundError)
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ cartoes: [falha(ERRO)] })

      await expect(new SupabaseCartaoRepository(client).atualizar(USER_ID, ID, PAYLOAD)).rejects.toBe(ERRO)
    })
  })

  describe('remover', () => {
    it('remove só o cartão do usuário', async () => {
      const fake = criarSupabaseFake({ cartoes: [ok({ id: ID })] })

      await expect(new SupabaseCartaoRepository(fake.client).remover(USER_ID, ID)).resolves.toBeUndefined()

      const consulta = fake.consultas[0]!
      expect(usou(consulta, 'delete')).toBe(true)
      expect(consulta.chamadas).toContainEqual(['eq', 'id', ID])
      expect(consulta.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
    })

    it('lança NotFoundError quando nenhuma linha é removida', async () => {
      const { client } = criarSupabaseFake({ cartoes: [ok(null)] })

      const promessa = new SupabaseCartaoRepository(client).remover(USER_ID, ID)

      await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
      await expect(promessa).rejects.toMatchObject({ message: 'Cartão não encontrado.' })
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ cartoes: [falha(ERRO)] })

      await expect(new SupabaseCartaoRepository(client).remover(USER_ID, ID)).rejects.toBe(ERRO)
    })
  })
})
