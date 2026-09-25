import { describe, expect, it } from 'vitest'

import { CriarCartao } from '../../../../src/application/use-cases/cartoes/CriarCartao'
import type { Cartao, CartaoPayload } from '../../../../src/domain/entities/Cartao'
import { ConflictError } from '../../../../src/domain/errors/DomainError'
import { criarCartaoRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
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
const CRIADO: Cartao = { ...PAYLOAD, id: 'cartao-1', criadoEm: '2026-01-01T00:00:00.000Z' }

describe('CriarCartao', () => {
  it('cria com o payload para o usuário e devolve o cartão criado', async () => {
    const repositorio = criarCartaoRepositoryFake()
    repositorio.criar.mockResolvedValue(CRIADO)

    await expect(new CriarCartao(repositorio).execute(USER_ID, PAYLOAD)).resolves.toBe(CRIADO)

    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, PAYLOAD)
  })

  it('propaga o erro do repositório', async () => {
    const erro = new ConflictError('Cartão já cadastrado.')
    const repositorio = criarCartaoRepositoryFake()
    repositorio.criar.mockRejectedValue(erro)

    await expect(new CriarCartao(repositorio).execute(USER_ID, PAYLOAD)).rejects.toBe(erro)
  })
})
