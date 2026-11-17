import { describe, expect, it } from 'vitest'

import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { SupabaseRecompensaPadraoRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseRecompensaPadraoRepository'
import { USER_ID } from '../../../helpers/linhasSupabase'
import { criarSupabaseFake, falha, ok } from '../../../helpers/supabaseFake'

const ERRO = { message: 'falha no banco' }

describe('SupabaseRecompensaPadraoRepository', () => {
  it('obter: lê só o perfil do usuário; sem perfil ou sem valor devolve null; propaga erro', async () => {
    const fake = criarSupabaseFake({ profiles: [ok({ recompensa_padrao: 'Cinema' }), ok(null), ok({ recompensa_padrao: null }), falha(ERRO)] })
    const repositorio = new SupabaseRecompensaPadraoRepository(fake.client)

    expect(await repositorio.obter(USER_ID)).toBe('Cinema')
    expect(await repositorio.obter(USER_ID)).toBeNull()
    expect(await repositorio.obter(USER_ID)).toBeNull()
    await expect(repositorio.obter(USER_ID)).rejects.toBe(ERRO)

    expect(fake.consultas[0]!.tabela).toBe('profiles')
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'id', USER_ID])
  })

  it('definir: atualiza só o perfil do usuário, devolve o valor gravado (ou null ao limpar)', async () => {
    const fake = criarSupabaseFake({ profiles: [ok({ recompensa_padrao: 'Pizza' }), ok({ recompensa_padrao: null })] })
    const repositorio = new SupabaseRecompensaPadraoRepository(fake.client)

    expect(await repositorio.definir(USER_ID, 'Pizza')).toBe('Pizza')
    expect(await repositorio.definir(USER_ID, null)).toBeNull()

    expect(fake.consultas[0]!.chamadas).toContainEqual(['update', { recompensa_padrao: 'Pizza' }])
    expect(fake.consultas[0]!.chamadas).toContainEqual(['eq', 'id', USER_ID])
  })

  it('definir: perfil inexistente vira NotFoundError e erro do banco é propagado', async () => {
    const fake = criarSupabaseFake({ profiles: [ok(null), falha(ERRO)] })
    const repositorio = new SupabaseRecompensaPadraoRepository(fake.client)

    await expect(repositorio.definir(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
    await expect(repositorio.definir(USER_ID, 'x')).rejects.toBe(ERRO)
  })
})
