import { describe, expect, it } from 'vitest'

import { ListarFaturasDoCartao } from '../../../../src/application/use-cases/cartoes/ListarFaturasDoCartao'
import type { FaturaFiltro } from '../../../../src/domain/entities/Fatura'
import { criarFaturaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'

describe('ListarFaturasDoCartao', () => {
  it('repassa userId e filtro (período + cartão) e devolve os cartões com suas faturas', async () => {
    const filtro: FaturaFiltro = { periodo: { mes: 8, ano: 2026 }, cartaoId: 'cartao-1' }
    const resultado = [{ cartao: { id: 'cartao-1' }, fatura: null, usoLimite: 0 }]
    const repositorio = criarFaturaRepositoryFake()
    repositorio.listarComFaturas.mockResolvedValue(resultado)

    await expect(new ListarFaturasDoCartao(repositorio).execute(USER_ID, filtro)).resolves.toBe(resultado)

    expect(repositorio.listarComFaturas).toHaveBeenCalledWith(USER_ID, filtro)
  })

  it('aceita filtro sem cartão (todos os cartões do usuário)', async () => {
    const filtro: FaturaFiltro = { periodo: { mes: 1, ano: 2026 } }
    const repositorio = criarFaturaRepositoryFake()
    repositorio.listarComFaturas.mockResolvedValue([])

    await expect(new ListarFaturasDoCartao(repositorio).execute(USER_ID, filtro)).resolves.toEqual([])

    expect(repositorio.listarComFaturas).toHaveBeenCalledWith(USER_ID, filtro)
  })

  it('propaga o erro do repositório', async () => {
    const erro = new Error('falha no banco')
    const repositorio = criarFaturaRepositoryFake()
    repositorio.listarComFaturas.mockRejectedValue(erro)

    await expect(
      new ListarFaturasDoCartao(repositorio).execute(USER_ID, { periodo: { mes: 8, ano: 2026 } }),
    ).rejects.toBe(erro)
  })
})
