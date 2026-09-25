import { describe, expect, it } from 'vitest'

import { RemoverTransacaoCartao } from '../../../../src/application/use-cases/cartoes/RemoverTransacaoCartao'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { criarFaturaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const ID = 'transacao-1'

describe('RemoverTransacaoCartao', () => {
  it('remove a transação pelo userId e id e resolve undefined', async () => {
    const repositorio = criarFaturaRepositoryFake()
    repositorio.removerTransacao.mockResolvedValue(undefined)

    await expect(new RemoverTransacaoCartao(repositorio).execute(USER_ID, ID)).resolves.toBeUndefined()

    expect(repositorio.removerTransacao).toHaveBeenCalledWith(USER_ID, ID)
  })

  it('propaga o NotFoundError quando a transação não existe para o usuário', async () => {
    const repositorio = criarFaturaRepositoryFake()
    repositorio.removerTransacao.mockRejectedValue(new NotFoundError('Transação do cartão'))

    const promessa = new RemoverTransacaoCartao(repositorio).execute(USER_ID, ID)

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ message: 'Transação do cartão não encontrado.' })
  })
})
