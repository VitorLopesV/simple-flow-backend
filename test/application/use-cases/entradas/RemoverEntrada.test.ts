import { describe, expect, it } from 'vitest'

import { RemoverEntrada } from '../../../../src/application/use-cases/entradas/RemoverEntrada'
import type { Entrada } from '../../../../src/domain/entities/Entrada'
import { NotFoundError, SerieAlteradaError } from '../../../../src/domain/errors/DomainError'
import { criarEntradaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const ID = '123e4567-e89b-12d3-a456-426614174000'
const SERIE = 'serie-1'

function entrada(sobrescritas: Partial<Entrada> = {}): Entrada {
  return {
    id: ID,
    descricao: 'Salário',
    valor: 5000,
    data: '2026-09-05',
    categoriaId: 'cat-renda-fixa',
    tipo: 'SALARIO',
    recorrente: false,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    serieId: null,
    editadoManualmente: false,
    ...sobrescritas,
  }
}

function criarRepositorio(existente: Entrada | null, seguintes: Entrada[] = []) {
  const repositorio = criarEntradaRepositoryFake()
  repositorio.buscarPorId.mockResolvedValue(existente)
  repositorio.listarSeguintesDaSerie.mockResolvedValue(seguintes)
  return repositorio
}

describe('RemoverEntrada', () => {
  it('entrada avulsa: remove só ela', async () => {
    const repositorio = criarRepositorio(entrada())

    await expect(new RemoverEntrada(repositorio).execute(USER_ID, ID)).resolves.toBeUndefined()

    expect(repositorio.remover).toHaveBeenCalledWith(USER_ID, ID)
    expect(repositorio.removerVarios).not.toHaveBeenCalled()
  })

  it('lança NotFoundError quando a entrada não existe para o usuário (isolamento)', async () => {
    const repositorio = criarRepositorio(null)

    const promessa = new RemoverEntrada(repositorio).execute(USER_ID, ID)

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
    expect(repositorio.buscarPorId).toHaveBeenCalledWith(USER_ID, ID)
    expect(repositorio.remover).not.toHaveBeenCalled()
  })

  it('mês de uma série: remove ele e os seguintes não alterados e encerra a série', async () => {
    const outubro = entrada({ id: 'out', data: '2026-10-05', recorrente: true, serieId: SERIE })
    const repositorio = criarRepositorio(entrada({ recorrente: true, serieId: SERIE }), [outubro])

    await new RemoverEntrada(repositorio).execute(USER_ID, ID)

    expect(repositorio.listarSeguintesDaSerie).toHaveBeenCalledWith(USER_ID, SERIE, '2026-09-05')
    expect(repositorio.removerVarios).toHaveBeenCalledWith(USER_ID, [ID, 'out'])
    expect(repositorio.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
    expect(repositorio.remover).not.toHaveBeenCalled()
  })

  it('com mês seguinte alterado, exige confirmação e não remove nada', async () => {
    const outubro = entrada({ id: 'out', data: '2026-10-05', serieId: SERIE, editadoManualmente: true })
    const repositorio = criarRepositorio(entrada({ recorrente: true, serieId: SERIE }), [outubro])

    const promessa = new RemoverEntrada(repositorio).execute(USER_ID, ID)

    await expect(promessa).rejects.toBeInstanceOf(SerieAlteradaError)
    await expect(promessa).rejects.toMatchObject({ detalhes: { mesesAfetados: ['2026-10'] } })
    expect(repositorio.removerVarios).not.toHaveBeenCalled()
    expect(repositorio.marcarSerieEncerrada).not.toHaveBeenCalled()
  })

  it('com confirmação, remove inclusive os meses alterados', async () => {
    const outubro = entrada({ id: 'out', data: '2026-10-05', serieId: SERIE, editadoManualmente: true })
    const repositorio = criarRepositorio(entrada({ recorrente: true, serieId: SERIE }), [outubro])

    await new RemoverEntrada(repositorio).execute(USER_ID, ID, { confirmar: true })

    expect(repositorio.removerVarios).toHaveBeenCalledWith(USER_ID, [ID, 'out'])
  })
})
