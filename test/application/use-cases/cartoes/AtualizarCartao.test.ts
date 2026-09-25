import { describe, expect, it } from 'vitest'

import { AtualizarCartao } from '../../../../src/application/use-cases/cartoes/AtualizarCartao'
import type { Cartao, CartaoPayload } from '../../../../src/domain/entities/Cartao'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { criarCartaoRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const ID = 'cartao-1'
const PAYLOAD: CartaoPayload = {
  nome: 'Nubank Ultravioleta',
  bandeira: 'MASTERCARD',
  ultimosDigitos: '1234',
  limite: 8000,
  diaFechamento: 5,
  diaVencimento: 12,
  cor: '#000000',
  ativo: false,
}
const ATUALIZADO: Cartao = { ...PAYLOAD, id: ID, criadoEm: '2026-01-01T00:00:00.000Z' }

describe('AtualizarCartao', () => {
  it('atualiza pelo userId e id com o payload e devolve o cartão atualizado', async () => {
    const repositorio = criarCartaoRepositoryFake()
    repositorio.atualizar.mockResolvedValue(ATUALIZADO)

    await expect(new AtualizarCartao(repositorio).execute(USER_ID, ID, PAYLOAD)).resolves.toBe(ATUALIZADO)

    expect(repositorio.atualizar).toHaveBeenCalledWith(USER_ID, ID, PAYLOAD)
  })

  it('propaga o NotFoundError quando o cartão não existe para o usuário', async () => {
    const repositorio = criarCartaoRepositoryFake()
    repositorio.atualizar.mockRejectedValue(new NotFoundError('Cartão'))

    await expect(new AtualizarCartao(repositorio).execute(USER_ID, ID, PAYLOAD)).rejects.toBeInstanceOf(NotFoundError)
  })
})
