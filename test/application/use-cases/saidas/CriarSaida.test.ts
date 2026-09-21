import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CriarSaida } from '../../../../src/application/use-cases/saidas/CriarSaida'
import type { Saida, SaidaPayload } from '../../../../src/domain/entities/Saida'
import type { SaidaRepository } from '../../../../src/domain/repositories/SaidaRepository'

const USER_ID = 'user-1'
const HOJE = '2026-09-15'

function payload(sobrescritas: Partial<SaidaPayload> = {}): SaidaPayload {
  return {
    descricao: 'Aluguel',
    valor: 1500,
    data: '2026-09-10',
    categoriaId: 'cat-1',
    tipo: 'OUTROS',
    status: 'PENDENTE',
    formaPagamento: 'PIX',
    recorrente: false,
    ...sobrescritas,
  }
}

function criarRepositorio() {
  return {
    listar: vi.fn(),
    resumo: vi.fn(),
    listarComProjecao: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(
      async (_userId: string, dados: SaidaPayload): Promise<Saida> => ({
        ...dados,
        id: 'nova',
        criadoEm: '2026-09-15T12:00:00.000Z',
        atualizadoEm: '2026-09-15T12:00:00.000Z',
        automatica: false,
      }),
    ),
    atualizar: vi.fn(),
    remover: vi.fn(),
  } satisfies SaidaRepository
}

describe('CriarSaida', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('define pagoEm como hoje quando o status é PAGO', async () => {
    const repositorio = criarRepositorio()

    await new CriarSaida(repositorio).execute(USER_ID, payload({ status: 'PAGO' }))

    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ pagoEm: HOJE }))
  })

  it('define pagoEm como null quando o status é PENDENTE', async () => {
    const repositorio = criarRepositorio()

    await new CriarSaida(repositorio).execute(USER_ID, payload({ status: 'PENDENTE' }))

    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ pagoEm: null }))
  })

  it('sobrescreve para null o pagoEm enviado pelo cliente em saída PENDENTE', async () => {
    const repositorio = criarRepositorio()
    const enviado = { ...payload({ status: 'PENDENTE' }), pagoEm: '2020-01-01' } as SaidaPayload

    await new CriarSaida(repositorio).execute(USER_ID, enviado)

    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ pagoEm: null }))
  })

  it('sobrescreve para hoje o pagoEm enviado pelo cliente em saída PAGA', async () => {
    const repositorio = criarRepositorio()
    const enviado = { ...payload({ status: 'PAGO' }), pagoEm: '2020-01-01' } as SaidaPayload

    await new CriarSaida(repositorio).execute(USER_ID, enviado)

    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ pagoEm: HOJE }))
  })

  it('repassa userId e demais campos sem alteração e retorna a saída do repositório', async () => {
    const repositorio = criarRepositorio()
    const dados = payload({ observacao: 'obs', vencimento: '2026-09-20' })

    const resultado = await new CriarSaida(repositorio).execute(USER_ID, dados)

    expect(repositorio.criar).toHaveBeenCalledWith(USER_ID, { ...dados, pagoEm: null })
    expect(resultado).toBe(await repositorio.criar.mock.results[0]!.value)
  })

  it('propaga o erro quando o repositório rejeita', async () => {
    const repositorio = criarRepositorio()
    const erro = new Error('falha no banco')
    repositorio.criar.mockRejectedValueOnce(erro)

    await expect(new CriarSaida(repositorio).execute(USER_ID, payload())).rejects.toBe(erro)
  })
})
