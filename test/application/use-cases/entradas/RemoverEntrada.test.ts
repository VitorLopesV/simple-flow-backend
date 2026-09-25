import { describe, expect, it } from 'vitest'

import { RemoverEntrada } from '../../../../src/application/use-cases/entradas/RemoverEntrada'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import { criarEntradaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const ID = '123e4567-e89b-12d3-a456-426614174000'

describe('RemoverEntrada', () => {
  it('remove pelo userId e id e resolve undefined', async () => {
    const repositorio = criarEntradaRepositoryFake()
    repositorio.remover.mockResolvedValue(undefined)

    await expect(new RemoverEntrada(repositorio).execute(USER_ID, ID)).resolves.toBeUndefined()

    expect(repositorio.remover).toHaveBeenCalledWith(USER_ID, ID)
  })

  it('propaga o NotFoundError quando a entrada não existe para o usuário', async () => {
    const repositorio = criarEntradaRepositoryFake()
    repositorio.remover.mockRejectedValue(new NotFoundError('Entrada'))

    const promessa = new RemoverEntrada(repositorio).execute(USER_ID, ID)

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
  })
})
