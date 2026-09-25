import { describe, expect, it, vi } from 'vitest'

import { AtualizarEntrada } from '../../../../src/application/use-cases/entradas/AtualizarEntrada'
import type { Entrada, EntradaPayload } from '../../../../src/domain/entities/Entrada'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import type { EntradaRepository } from '../../../../src/domain/repositories/EntradaRepository'

const USER_ID = 'user-1'
const ID_ENTRADA = '123e4567-e89b-12d3-a456-426614174000'
const ID_PROJETADO = `${ID_ENTRADA}_2026-09`

function entrada(sobrescritas: Partial<Entrada> = {}): Entrada {
  return {
    id: ID_ENTRADA,
    descricao: 'Salário',
    valor: 5000,
    data: '2026-08-05',
    categoriaId: 'cat-1',
    recorrente: false,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

function payload(sobrescritas: Partial<EntradaPayload> = {}): EntradaPayload {
  return {
    descricao: 'Salário',
    valor: 5000,
    data: '2026-08-05',
    categoriaId: 'cat-1',
    recorrente: false,
    ...sobrescritas,
  }
}

function criarRepositorio(existentes: Entrada[] = []) {
  return {
    listar: vi.fn(),
    resumo: vi.fn(),
    listarComProjecao: vi.fn(),
    buscarPorId: vi.fn(async (_userId: string, id: string) => existentes.find((e) => e.id === id) ?? null),
    criar: vi.fn(async (_userId: string, dados: EntradaPayload) => entrada({ ...dados, id: 'nova' })),
    atualizar: vi.fn(async (_userId: string, id: string, dados: EntradaPayload) => entrada({ ...dados, id })),
    remover: vi.fn(),
  } satisfies EntradaRepository
}

describe('AtualizarEntrada', () => {
  it('mantém a descrição atual e chama atualizar com o id quando atual e payload são recorrentes', async () => {
    const repositorio = criarRepositorio([entrada({ recorrente: true, descricao: 'Salário' })])

    await new AtualizarEntrada(repositorio).execute(
      USER_ID,
      ID_ENTRADA,
      payload({ recorrente: true, descricao: 'Salário novo' }),
    )

    expect(repositorio.atualizar).toHaveBeenCalledWith(
      USER_ID,
      ID_ENTRADA,
      expect.objectContaining({ descricao: 'Salário' }),
    )
  })

  it('aplica a nova descrição quando a entrada atual não é recorrente', async () => {
    const repositorio = criarRepositorio([entrada({ recorrente: false })])

    await new AtualizarEntrada(repositorio).execute(USER_ID, ID_ENTRADA, payload({ descricao: 'Salário novo' }))

    expect(repositorio.atualizar).toHaveBeenCalledWith(
      USER_ID,
      ID_ENTRADA,
      expect.objectContaining({ descricao: 'Salário novo' }),
    )
  })

  it('aplica a nova descrição quando a entrada recorrente deixa de ser recorrente', async () => {
    const repositorio = criarRepositorio([entrada({ recorrente: true })])

    await new AtualizarEntrada(repositorio).execute(
      USER_ID,
      ID_ENTRADA,
      payload({ recorrente: false, descricao: 'Salário novo' }),
    )

    expect(repositorio.atualizar).toHaveBeenCalledWith(
      USER_ID,
      ID_ENTRADA,
      expect.objectContaining({ descricao: 'Salário novo' }),
    )
  })

  it('materializa id projetado de origem recorrente com criar e a descrição da origem', async () => {
    const repositorio = criarRepositorio([entrada({ recorrente: true, descricao: 'Salário' })])
    const dados = payload({ descricao: 'Outro nome', data: '2026-09-05', recorrente: true })

    await new AtualizarEntrada(repositorio).execute(USER_ID, ID_PROJETADO, dados)

    expect(repositorio.buscarPorId).toHaveBeenCalledWith(USER_ID, ID_ENTRADA)
    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, { ...dados, descricao: 'Salário' })
    expect(repositorio.atualizar).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para id projetado cuja origem não é recorrente', async () => {
    const repositorio = criarRepositorio([entrada({ recorrente: false })])

    const promessa = new AtualizarEntrada(repositorio).execute(USER_ID, ID_PROJETADO, payload())

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
    expect(repositorio.criar).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para id projetado cuja origem não existe', async () => {
    const repositorio = criarRepositorio()

    await expect(new AtualizarEntrada(repositorio).execute(USER_ID, ID_PROJETADO, payload())).rejects.toBeInstanceOf(
      NotFoundError,
    )
    expect(repositorio.criar).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para id comum inexistente sem segunda busca no repositório', async () => {
    const repositorio = criarRepositorio()

    await expect(new AtualizarEntrada(repositorio).execute(USER_ID, ID_ENTRADA, payload())).rejects.toBeInstanceOf(
      NotFoundError,
    )
    expect(repositorio.buscarPorId).toHaveBeenCalledTimes(1)
  })

  it('repassa o userId a todas as chamadas do repositório', async () => {
    const repositorio = criarRepositorio([entrada({ recorrente: true })])
    const useCase = new AtualizarEntrada(repositorio)

    await useCase.execute(USER_ID, ID_ENTRADA, payload())
    await useCase.execute(USER_ID, ID_PROJETADO, payload())

    expect(repositorio.buscarPorId.mock.calls.every(([userId]) => userId === USER_ID)).toBe(true)
    expect(repositorio.atualizar.mock.calls[0]![0]).toBe(USER_ID)
    expect(repositorio.criar.mock.calls[0]![0]).toBe(USER_ID)
  })
})
