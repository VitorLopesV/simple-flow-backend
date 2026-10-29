import { beforeEach, describe, expect, it, vi } from 'vitest'

import { keepaliveController } from '../../../../src/presentation/http/controllers/keepaliveController'
import { criarRequisicao, criarResposta } from '../../../helpers/http'
import { criarSupabaseFake, falha, ok } from '../../../helpers/supabaseFake'

const m = vi.hoisted(() => ({ supabaseAnonClient: vi.fn() }))

vi.mock('../../../../src/infrastructure/supabase/supabaseClientForRequest', () => ({
  supabaseAnonClient: m.supabaseAnonClient,
}))

describe('keepaliveController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verificar: consulta uma categoria com o client anônimo e responde ok', async () => {
    const supabase = criarSupabaseFake({ categorias: [ok([{ id: 'cat-1' }])] })
    m.supabaseAnonClient.mockReturnValue(supabase.client)
    const res = criarResposta()

    await keepaliveController.verificar(criarRequisicao(), res)

    expect(supabase.consultasDe('categorias')[0]!.chamadas).toEqual([['select', 'id'], ['limit', 1]])
    expect(res.json).toHaveBeenCalledWith({ status: 'ok' })
  })

  it('verificar: propaga o erro do Supabase sem responder', async () => {
    const erro = new Error('banco pausado')
    m.supabaseAnonClient.mockReturnValue(criarSupabaseFake({ categorias: [falha(erro)] }).client)
    const res = criarResposta()

    await expect(keepaliveController.verificar(criarRequisicao(), res)).rejects.toBe(erro)
    expect(res.json).not.toHaveBeenCalled()
  })
})
