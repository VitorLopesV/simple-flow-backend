import { describe, expect, it } from 'vitest'

import { CriarEntrada } from '../../../../src/application/use-cases/entradas/CriarEntrada'
import type { Entrada, EntradaPayload } from '../../../../src/domain/entities/Entrada'
import { ValidationError } from '../../../../src/domain/errors/DomainError'
import { criarEntradaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const PAYLOAD: EntradaPayload = {
  descricao: 'Salário',
  valor: 5000,
  data: '2026-08-05',
  categoriaId: 'cat-1',
  recorrente: true,
  observacao: null,
}
const CRIADA: Entrada = {
  ...PAYLOAD,
  id: 'entrada-1',
  criadoEm: '2026-08-05T12:00:00.000Z',
  atualizadoEm: '2026-08-05T12:00:00.000Z',
}

describe('CriarEntrada', () => {
  it('cria com o payload inalterado para o usuário e devolve a entrada criada', async () => {
    const repositorio = criarEntradaRepositoryFake()
    repositorio.criar.mockResolvedValue(CRIADA)

    await expect(new CriarEntrada(repositorio).execute(USER_ID, PAYLOAD)).resolves.toBe(CRIADA)

    expect(repositorio.criar).toHaveBeenCalledTimes(1)
    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, PAYLOAD)
  })

  it('propaga o erro do repositório', async () => {
    const erro = new ValidationError('Categoria inexistente.')
    const repositorio = criarEntradaRepositoryFake()
    repositorio.criar.mockRejectedValue(erro)

    const promessa = new CriarEntrada(repositorio).execute(USER_ID, PAYLOAD)

    await expect(promessa).rejects.toBe(erro)
    await expect(promessa).rejects.toMatchObject({ status: 422 })
  })
})
