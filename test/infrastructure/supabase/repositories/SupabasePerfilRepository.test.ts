import { describe, expect, it } from 'vitest'

import type { PerfilPayload } from '../../../../src/domain/entities/Usuario'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabasePerfilRepository } from '../../../../src/infrastructure/supabase/repositories/SupabasePerfilRepository'
import { USER_ID } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok, usou } from '../../../helpers/supabaseFake'

const ERRO = { message: 'falha no banco' }
const FOTO = 'data:image/jpeg;base64,AAAA'
const LINHA = { nome: 'Ana Souza', telefone: '11999998888', foto_url: FOTO }
const PERFIL = { nome: 'Ana Souza', telefone: '11999998888', fotoUrl: FOTO }

describe('SupabasePerfilRepository', () => {
  describe('buscar', () => {
    it('lê só o perfil do usuário e mapeia foto_url para fotoUrl', async () => {
      const fake = criarSupabaseFake({ profiles: [ok(LINHA)] })

      await expect(new SupabasePerfilRepository(fake.client).buscar(USER_ID)).resolves.toEqual(PERFIL)

      expect(fake.consultas[0]!.chamadas).toEqual([
        ['select', 'nome, telefone, foto_url'],
        ['eq', 'id', USER_ID],
        ['maybeSingle'],
      ])
    })

    it('devolve null quando o perfil não existe', async () => {
      const { client } = criarSupabaseFake({ profiles: [ok(null)] })

      await expect(new SupabasePerfilRepository(client).buscar(USER_ID)).resolves.toBeNull()
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ profiles: [falha(ERRO)] })

      await expect(new SupabasePerfilRepository(client).buscar(USER_ID)).rejects.toBe(ERRO)
    })
  })

  describe('atualizar', () => {
    it('grava nome, telefone e foto em snake_case só na linha do usuário', async () => {
      const fake = criarSupabaseFake({ profiles: [ok(LINHA)] })

      await expect(new SupabasePerfilRepository(fake.client).atualizar(USER_ID, PERFIL)).resolves.toEqual(PERFIL)

      expect(fake.consultas[0]!.chamadas).toEqual([
        ['update', { nome: 'Ana Souza', telefone: '11999998888', foto_url: FOTO }],
        ['eq', 'id', USER_ID],
        ['select', 'nome, telefone, foto_url'],
        ['maybeSingle'],
      ])
    })

    it('grava só as colunas dos campos presentes (atualização parcial)', async () => {
      const fake = criarSupabaseFake({ profiles: [ok(LINHA)] })

      await new SupabasePerfilRepository(fake.client).atualizar(USER_ID, { telefone: '1133334444' })

      expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ telefone: '1133334444' }])
    })

    it('grava null para remover telefone e foto', async () => {
      const fake = criarSupabaseFake({ profiles: [ok({ ...LINHA, telefone: null, foto_url: null })] })

      const perfil = await new SupabasePerfilRepository(fake.client).atualizar(USER_ID, { telefone: null, fotoUrl: null })

      expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ telefone: null, foto_url: null }])
      expect(perfil).toEqual({ nome: 'Ana Souza', telefone: null, fotoUrl: null })
    })

    it('ignora campos que não são do perfil, como um id de outro usuário', async () => {
      const fake = criarSupabaseFake({ profiles: [ok(LINHA)] })
      const payload = { nome: 'Ana', id: 'outro-usuario' } as PerfilPayload

      await new SupabasePerfilRepository(fake.client).atualizar(USER_ID, payload)

      expect(argumentos(fake.consultas[0]!, 'update')).toEqual([{ nome: 'Ana' }])
      expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'id', USER_ID])
    })

    it('sem nenhum campo de perfil, não faz update e devolve o perfil atual', async () => {
      const fake = criarSupabaseFake({ profiles: [ok(LINHA)] })

      await expect(new SupabasePerfilRepository(fake.client).atualizar(USER_ID, {})).resolves.toEqual(PERFIL)

      expect(fake.consultas).toHaveLength(1)
      expect(usou(fake.consultas[0]!, 'update')).toBe(false)
    })

    it('sem nenhum campo de perfil e sem perfil gravado, lança NotFoundError', async () => {
      const { client } = criarSupabaseFake({ profiles: [ok(null)] })

      await expect(new SupabasePerfilRepository(client).atualizar(USER_ID, {})).rejects.toBeInstanceOf(NotFoundError)
    })

    it('lança NotFoundError quando nenhuma linha é atualizada (RLS barrou ou perfil inexistente)', async () => {
      const { client } = criarSupabaseFake({ profiles: [ok(null)] })

      const promessa = new SupabasePerfilRepository(client).atualizar(USER_ID, { nome: 'Ana' })

      await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
      await expect(promessa).rejects.toMatchObject({ message: 'Perfil não encontrado.' })
    })

    it('propaga o erro do banco', async () => {
      const { client } = criarSupabaseFake({ profiles: [falha(ERRO)] })

      await expect(new SupabasePerfilRepository(client).atualizar(USER_ID, { nome: 'Ana' })).rejects.toBe(ERRO)
    })
  })
})
