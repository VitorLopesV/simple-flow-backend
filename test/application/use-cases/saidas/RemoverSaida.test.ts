import { describe, expect, it, vi } from 'vitest'

import { RemoverSaida } from '../../../../src/application/use-cases/saidas/RemoverSaida'
import type { Saida } from '../../../../src/domain/entities/Saida'
import { ConflictError, NotFoundError } from '../../../../src/domain/errors/DomainError'
import type { SaidaRepository } from '../../../../src/domain/repositories/SaidaRepository'

const USER_ID = 'user-1'
const ID_SAIDA = '123e4567-e89b-12d3-a456-426614174000'

function saida(sobrescritas: Partial<Saida> = {}): Saida {
  return {
    id: ID_SAIDA,
    descricao: 'Aluguel',
    valor: 1500,
    data: '2026-09-10',
    categoriaId: 'cat-1',
    tipo: 'OUTROS',
    status: 'PENDENTE',
    formaPagamento: 'PIX',
    recorrente: false,
    criadoEm: '2026-09-01T00:00:00.000Z',
    atualizadoEm: '2026-09-01T00:00:00.000Z',
    automatica: false,
    ...sobrescritas,
  }
}

function criarRepositorio(existente: Saida | null) {
  return {
    listar: vi.fn(),
    resumo: vi.fn(),
    listarComProjecao: vi.fn(),
    buscarPorId: vi.fn(async () => existente),
    criar: vi.fn(),
    atualizar: vi.fn(),
    remover: vi.fn(async () => undefined),
  } satisfies SaidaRepository
}

describe('RemoverSaida', () => {
  it('lança NotFoundError para saída inexistente sem chamar remover', async () => {
    const repositorio = criarRepositorio(null)

    const promessa = new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
    expect(repositorio.remover).not.toHaveBeenCalled()
  })

  it('lança ConflictError para saída automática sem chamar remover', async () => {
    const repositorio = criarRepositorio(saida({ automatica: true }))

    const promessa = new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    await expect(promessa).rejects.toMatchObject({ status: 409 })
    expect(repositorio.remover).not.toHaveBeenCalled()
  })

  it('remove saída comum com userId e id e resolve undefined', async () => {
    const repositorio = criarRepositorio(saida())

    await expect(new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)).resolves.toBeUndefined()

    expect(repositorio.remover).toHaveBeenCalledWith(USER_ID, ID_SAIDA)
  })

  it('propaga o erro quando o repositório rejeita ao remover', async () => {
    const repositorio = criarRepositorio(saida())
    const erro = new Error('falha no banco')
    repositorio.remover.mockRejectedValueOnce(erro)

    await expect(new RemoverSaida(repositorio).execute(USER_ID, ID_SAIDA)).rejects.toBe(erro)
  })
})
