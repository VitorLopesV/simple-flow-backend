import { describe, expect, it } from 'vitest'

import { PagarFatura } from '../../../../src/application/use-cases/cartoes/PagarFatura'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { criarFaturaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const FATURA_ID = 'fatura-1'

describe('PagarFatura', () => {
  it('paga a fatura pelo userId e id e resolve undefined', async () => {
    const repositorio = criarFaturaRepositoryFake()
    repositorio.pagar.mockResolvedValue(undefined)

    await expect(new PagarFatura(repositorio).execute(USER_ID, FATURA_ID)).resolves.toBeUndefined()

    expect(repositorio.pagar).toHaveBeenCalledWith(USER_ID, FATURA_ID)
  })

  it('propaga o NotFoundError quando a fatura não existe para o usuário', async () => {
    const repositorio = criarFaturaRepositoryFake()
    repositorio.pagar.mockRejectedValue(new NotFoundError('Fatura'))

    const promessa = new PagarFatura(repositorio).execute(USER_ID, FATURA_ID)

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
  })
})
