import { describe, expect, it } from 'vitest'

import { RemoverCartao } from '../../../../src/application/use-cases/cartoes/RemoverCartao'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { criarCartaoRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const ID = 'cartao-1'

describe('RemoverCartao', () => {
  it('remove pelo userId e id e resolve undefined', async () => {
    const repositorio = criarCartaoRepositoryFake()
    repositorio.remover.mockResolvedValue(undefined)

    await expect(new RemoverCartao(repositorio).execute(USER_ID, ID)).resolves.toBeUndefined()

    expect(repositorio.remover).toHaveBeenCalledWith(USER_ID, ID)
  })

  it('propaga o NotFoundError quando o cartão não existe para o usuário', async () => {
    const repositorio = criarCartaoRepositoryFake()
    repositorio.remover.mockRejectedValue(new NotFoundError('Cartão'))

    const promessa = new RemoverCartao(repositorio).execute(USER_ID, ID)

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404, message: 'Cartão não encontrado.' })
  })
})
