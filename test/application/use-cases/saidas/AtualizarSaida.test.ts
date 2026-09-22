import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AtualizarSaida } from '../../../../src/application/use-cases/saidas/AtualizarSaida'
import type { Saida, SaidaPayload } from '../../../../src/domain/entities/Saida'
import { ConflictError, NotFoundError } from '../../../../src/domain/errors/DomainError'
import type { SaidaRepository } from '../../../../src/domain/repositories/SaidaRepository'

const USER_ID = 'user-1'
const ID_SAIDA = '123e4567-e89b-12d3-a456-426614174000'
const ID_PROJETADO = `${ID_SAIDA}_2026-09`
const HOJE = '2026-09-15'

function saida(sobrescritas: Partial<Saida> = {}): Saida {
  return {
    id: ID_SAIDA,
    descricao: 'Aluguel',
    valor: 1500,
    data: '2026-08-10',
    categoriaId: 'cat-1',
    tipo: 'OUTROS',
    status: 'PENDENTE',
    pagoEm: null,
    formaPagamento: 'PIX',
    recorrente: false,
    criadoEm: '2026-08-01T00:00:00.000Z',
    atualizadoEm: '2026-08-01T00:00:00.000Z',
    automatica: false,
    ...sobrescritas,
  }
}

function payload(sobrescritas: Partial<SaidaPayload> = {}): SaidaPayload {
  return {
    descricao: 'Aluguel',
    valor: 1500,
    data: '2026-08-10',
    categoriaId: 'cat-1',
    tipo: 'OUTROS',
    status: 'PENDENTE',
    formaPagamento: 'PIX',
    recorrente: false,
    ...sobrescritas,
  }
}

function criarRepositorio(existentes: Saida[] = []) {
  return {
    listar: vi.fn(),
    resumo: vi.fn(),
    listarComProjecao: vi.fn(),
    buscarPorId: vi.fn(async (_userId: string, id: string) => existentes.find((s) => s.id === id) ?? null),
    criar: vi.fn(async (_userId: string, dados: SaidaPayload) => saida({ ...dados, id: 'nova' })),
    atualizar: vi.fn(async (_userId: string, id: string, dados: SaidaPayload) => saida({ ...dados, id })),
    remover: vi.fn(),
  } satisfies SaidaRepository
}

describe('AtualizarSaida', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('define pagoEm como hoje ao mudar de PENDENTE para PAGO', async () => {
    const repositorio = criarRepositorio([saida({ status: 'PENDENTE' })])

    await new AtualizarSaida(repositorio).execute(USER_ID, ID_SAIDA, payload({ status: 'PAGO' }))

    expect(repositorio.atualizar).toHaveBeenCalledWith(USER_ID, ID_SAIDA, expect.objectContaining({ pagoEm: HOJE }))
  })

  it('preserva o pagoEm original ao editar uma saída já paga que continua paga', async () => {
    const repositorio = criarRepositorio([saida({ status: 'PAGO', pagoEm: '2026-08-12' })])

    await new AtualizarSaida(repositorio).execute(USER_ID, ID_SAIDA, payload({ status: 'PAGO', valor: 1600 }))

    expect(repositorio.atualizar).toHaveBeenCalledWith(
      USER_ID,
      ID_SAIDA,
      expect.objectContaining({ pagoEm: '2026-08-12' }),
    )
  })

  it('limpa pagoEm ao voltar de PAGO para PENDENTE', async () => {
    const repositorio = criarRepositorio([saida({ status: 'PAGO', pagoEm: '2026-08-12' })])

    await new AtualizarSaida(repositorio).execute(USER_ID, ID_SAIDA, payload({ status: 'PENDENTE' }))

    expect(repositorio.atualizar).toHaveBeenCalledWith(USER_ID, ID_SAIDA, expect.objectContaining({ pagoEm: null }))
  })

  it('define pagoEm como hoje para saída PAGA legada sem pagoEm', async () => {
    const repositorio = criarRepositorio([saida({ status: 'PAGO', pagoEm: null })])

    await new AtualizarSaida(repositorio).execute(USER_ID, ID_SAIDA, payload({ status: 'PAGO' }))

    expect(repositorio.atualizar).toHaveBeenCalledWith(USER_ID, ID_SAIDA, expect.objectContaining({ pagoEm: HOJE }))
  })

  it('mantém a descrição atual quando atual e payload são recorrentes', async () => {
    const repositorio = criarRepositorio([saida({ recorrente: true, descricao: 'Aluguel' })])

    await new AtualizarSaida(repositorio).execute(
      USER_ID,
      ID_SAIDA,
      payload({ recorrente: true, descricao: 'Aluguel novo' }),
    )

    expect(repositorio.atualizar).toHaveBeenCalledWith(
      USER_ID,
      ID_SAIDA,
      expect.objectContaining({ descricao: 'Aluguel' }),
    )
  })

  it('aplica a nova descrição quando a saída atual não é recorrente', async () => {
    const repositorio = criarRepositorio([saida({ recorrente: false })])

    await new AtualizarSaida(repositorio).execute(USER_ID, ID_SAIDA, payload({ descricao: 'Aluguel novo' }))

    expect(repositorio.atualizar).toHaveBeenCalledWith(
      USER_ID,
      ID_SAIDA,
      expect.objectContaining({ descricao: 'Aluguel novo' }),
    )
  })

  it('aplica a nova descrição quando a saída recorrente deixa de ser recorrente', async () => {
    const repositorio = criarRepositorio([saida({ recorrente: true })])

    await new AtualizarSaida(repositorio).execute(
      USER_ID,
      ID_SAIDA,
      payload({ recorrente: false, descricao: 'Aluguel novo' }),
    )

    expect(repositorio.atualizar).toHaveBeenCalledWith(
      USER_ID,
      ID_SAIDA,
      expect.objectContaining({ descricao: 'Aluguel novo' }),
    )
  })

  it('lança ConflictError para saída automática sem chamar atualizar', async () => {
    const repositorio = criarRepositorio([saida({ automatica: true })])

    const promessa = new AtualizarSaida(repositorio).execute(USER_ID, ID_SAIDA, payload())

    await expect(promessa).rejects.toBeInstanceOf(ConflictError)
    await expect(promessa).rejects.toMatchObject({ status: 409 })
    expect(repositorio.atualizar).not.toHaveBeenCalled()
  })

  it('materializa id projetado de origem recorrente com criar, descrição da origem e pagoEm conforme o status', async () => {
    const repositorio = criarRepositorio([saida({ recorrente: true, descricao: 'Aluguel' })])
    const dados = payload({ descricao: 'Outro nome', status: 'PENDENTE', data: '2026-09-10' })

    await new AtualizarSaida(repositorio).execute(USER_ID, ID_PROJETADO, dados)

    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, { ...dados, descricao: 'Aluguel', pagoEm: null })
    expect(repositorio.atualizar).not.toHaveBeenCalled()
  })

  it('cria a linha do id projetado com pagoEm de hoje quando o status é PAGO', async () => {
    const repositorio = criarRepositorio([saida({ recorrente: true })])

    await new AtualizarSaida(repositorio).execute(USER_ID, ID_PROJETADO, payload({ status: 'PAGO' }))

    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ status: 'PAGO', pagoEm: HOJE }))
  })

  it('lança NotFoundError para id projetado cuja origem não é recorrente', async () => {
    const repositorio = criarRepositorio([saida({ recorrente: false })])

    const promessa = new AtualizarSaida(repositorio).execute(USER_ID, ID_PROJETADO, payload())

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
    expect(repositorio.criar).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para id projetado cuja origem não existe', async () => {
    const repositorio = criarRepositorio()

    await expect(new AtualizarSaida(repositorio).execute(USER_ID, ID_PROJETADO, payload())).rejects.toBeInstanceOf(
      NotFoundError,
    )
    expect(repositorio.criar).not.toHaveBeenCalled()
  })

  it('lança NotFoundError para id comum inexistente', async () => {
    const repositorio = criarRepositorio()

    await expect(new AtualizarSaida(repositorio).execute(USER_ID, ID_SAIDA, payload())).rejects.toBeInstanceOf(
      NotFoundError,
    )
    expect(repositorio.atualizar).not.toHaveBeenCalled()
  })

  it('repassa o userId a todas as chamadas do repositório', async () => {
    const repositorio = criarRepositorio([saida({ recorrente: true })])
    const useCase = new AtualizarSaida(repositorio)

    await useCase.execute(USER_ID, ID_SAIDA, payload())
    await useCase.execute(USER_ID, ID_PROJETADO, payload())

    expect(repositorio.buscarPorId.mock.calls.every(([userId]) => userId === USER_ID)).toBe(true)
    expect(repositorio.atualizar.mock.calls[0]![0]).toBe(USER_ID)
    expect(repositorio.criar.mock.calls[0]![0]).toBe(USER_ID)
  })
})
