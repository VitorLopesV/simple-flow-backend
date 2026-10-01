import { describe, expect, it } from 'vitest'

import { RemoverSaida } from '../../../../src/application/use-cases/saidas/RemoverSaida'
import type { Saida } from '../../../../src/domain/entities/Saida'
import { ConflictError, NotFoundError, SerieAlteradaError } from '../../../../src/domain/errors/DomainError'
import { criarSaidaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const ID_SAIDA = '123e4567-e89b-12d3-a456-426614174000'
const SERIE = 'serie-1'

function saida(sobrescritas: Partial<Saida> = {}): Saida {
  return {
    id: ID_SAIDA,
    descricao: 'Aluguel',
    valor: 1500,
    data: '2026-09-10',
    categoriaId: 'cat-fixa',
    tipo: 'OUTROS',
    status: 'PENDENTE',
    formaPagamento: 'PIX',
    recorrente: false,
    criadoEm: '2026-09-01T00:00:00.000Z',
    atualizadoEm: '2026-09-01T00:00:00.000Z',
    automatica: false,
    serieId: null,
    editadoManualmente: false,
    ...sobrescritas,
  }
}

function criarRepositorio(existente: Saida | null, seguintes: Saida[] = []) {
  const repositorio = criarSaidaRepositoryFake()
  repositorio.buscarPorId.mockResolvedValue(existente)
  repositorio.listarSeguintesDaSerie.mockResolvedValue(seguintes)
  repositorio.remover.mockResolvedValue(undefined)
  return repositorio
}

describe('RemoverSaida', () => {
  it('lança NotFoundError para saída inexistente (inclusive de outro usuário) sem remover nada', async () => {
    const repositorio = criarRepositorio(null)

    const promessa = new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
    expect(repositorio.remover).not.toHaveBeenCalled()
    expect(repositorio.removerVarios).not.toHaveBeenCalled()
  })

  it('lança ConflictError para saída automática sem chamar remover', async () => {
    const repositorio = criarRepositorio(saida({ automatica: true }))

    const promessa = new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    await expect(promessa).rejects.toMatchObject({ status: 409 })
    expect(repositorio.remover).not.toHaveBeenCalled()
  })

  it('remove saída avulsa com userId e id e resolve undefined', async () => {
    const repositorio = criarRepositorio(saida())

    await expect(new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)).resolves.toBeUndefined()

    expect(repositorio.remover).toHaveBeenCalledWith(USER_ID, ID_SAIDA)
    expect(repositorio.listarSeguintesDaSerie).not.toHaveBeenCalled()
  })

  it('mês de uma série: remove ele e os seguintes e encerra a série', async () => {
    const outubro = saida({ id: 'out', data: '2026-10-10', recorrente: true, serieId: SERIE })
    const repositorio = criarRepositorio(saida({ recorrente: true, serieId: SERIE }), [outubro])

    await new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)

    expect(repositorio.listarSeguintesDaSerie).toHaveBeenCalledWith(USER_ID, SERIE, '2026-09-10')
    expect(repositorio.removerVarios).toHaveBeenCalledWith(USER_ID, [ID_SAIDA, 'out'])
    expect(repositorio.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
  })

  it('mês seguinte marcado como PAGO conta como alterado: exige confirmação', async () => {
    const outubro = saida({ id: 'out', data: '2026-10-10', serieId: SERIE, status: 'PAGO', editadoManualmente: true })
    const repositorio = criarRepositorio(saida({ recorrente: true, serieId: SERIE }), [outubro])

    const promessa = new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)

    await expect(promessa).rejects.toBeInstanceOf(SerieAlteradaError)
    await expect(promessa).rejects.toMatchObject({ status: 409, detalhes: { mesesAfetados: ['2026-10'] } })
    expect(repositorio.removerVarios).not.toHaveBeenCalled()
  })

  it('com confirmação, remove inclusive os meses alterados', async () => {
    const outubro = saida({ id: 'out', data: '2026-10-10', serieId: SERIE, editadoManualmente: true })
    const repositorio = criarRepositorio(saida({ recorrente: true, serieId: SERIE }), [outubro])

    await new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA, { confirmar: true })

    expect(repositorio.removerVarios).toHaveBeenCalledWith(USER_ID, [ID_SAIDA, 'out'])
    expect(repositorio.marcarSerieEncerrada).toHaveBeenCalledWith(USER_ID, SERIE, true)
  })

  it('propaga o erro quando o repositório rejeita ao remover', async () => {
    const repositorio = criarRepositorio(saida())
    const erro = new Error('falha no banco')
    repositorio.remover.mockRejectedValueOnce(erro)

    await expect(new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)).rejects.toBe(erro)
  })
})
