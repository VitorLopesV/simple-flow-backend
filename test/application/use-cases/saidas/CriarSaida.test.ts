import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CriarSaida } from '../../../../src/application/use-cases/saidas/CriarSaida'
import type { Saida, SaidaPayload } from '../../../../src/domain/entities/Saida'
import { ValidationError } from '../../../../src/domain/errors/DomainError'
import { CATEGORIAS, criarCategoriaRepositoryFake, criarSaidaRepositoryFake } from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
const HOJE = '2026-09-15'
const UUID = /^[0-9a-f-]{36}$/

function payload(sobrescritas: Partial<SaidaPayload> = {}): SaidaPayload {
  return {
    descricao: 'Aluguel',
    valor: 1500,
    data: '2026-09-10',
    categoriaId: CATEGORIAS.despesaFixa.id,
    tipo: 'OUTROS',
    status: 'PENDENTE',
    formaPagamento: 'PIX',
    recorrente: false,
    ...sobrescritas,
  }
}

function criarRepositorios() {
  const saidas = criarSaidaRepositoryFake()
  saidas.criar.mockImplementation(
    async (_userId: string, dados: SaidaPayload, controle = {}): Promise<Saida> => ({
      ...dados,
      id: `saida-${saidas.criar.mock.calls.length}`,
      criadoEm: '2026-09-15T12:00:00.000Z',
      atualizadoEm: '2026-09-15T12:00:00.000Z',
      automatica: false,
      serieId: null,
      editadoManualmente: false,
      ...controle,
    }),
  )
  return { saidas, categorias: criarCategoriaRepositoryFake() }
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
    const { saidas, categorias } = criarRepositorios()

    await new CriarSaida(saidas, categorias).execute(USER_ID, payload({ status: 'PAGO' }))

    expect(saidas.criar).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ pagoEm: HOJE }))
  })

  it('define pagoEm como null quando o status é PENDENTE', async () => {
    const { saidas, categorias } = criarRepositorios()

    await new CriarSaida(saidas, categorias).execute(USER_ID, payload({ status: 'PENDENTE' }))

    expect(saidas.criar).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ pagoEm: null }))
  })

  it('sobrescreve o pagoEm enviado pelo cliente', async () => {
    const { saidas, categorias } = criarRepositorios()
    const pendente = { ...payload({ status: 'PENDENTE' }), pagoEm: '2020-01-01' } as SaidaPayload
    const paga = { ...payload({ status: 'PAGO' }), pagoEm: '2020-01-01' } as SaidaPayload

    await new CriarSaida(saidas, categorias).execute(USER_ID, pendente)
    await new CriarSaida(saidas, categorias).execute(USER_ID, paga)

    expect(saidas.criar.mock.calls[0]![1].pagoEm).toBeNull()
    expect(saidas.criar.mock.calls[1]![1].pagoEm).toBe(HOJE)
  })

  it('saída avulsa é criada uma vez só, sem série, e devolve a saída do repositório', async () => {
    const { saidas, categorias } = criarRepositorios()
    const dados = payload({ observacao: 'obs', vencimento: '2026-09-20' })

    const resultado = await new CriarSaida(saidas, categorias).execute(USER_ID, dados)

    expect(saidas.criar).toHaveBeenCalledTimes(1)
    expect(saidas.criar).toHaveBeenCalledWith(USER_ID, { ...dados, pagoEm: null })
    expect(resultado).toMatchObject({ id: 'saida-1', serieId: null })
  })

  it('Despesa Fixa recorrente cria também o mês seguinte, pendente, na mesma série', async () => {
    const { saidas, categorias } = criarRepositorios()
    const dados = payload({ recorrente: true, status: 'PAGO', vencimento: '2026-09-12' })

    const criada = await new CriarSaida(saidas, categorias).execute(USER_ID, dados)

    expect(saidas.criar).toHaveBeenCalledTimes(2)
    const [, original, controleOriginal] = saidas.criar.mock.calls[0]!
    const [, seguinte, controleSeguinte] = saidas.criar.mock.calls[1]!
    expect(original).toEqual({ ...dados, pagoEm: HOJE })
    expect(controleOriginal!.serieId).toMatch(UUID)
    expect(controleSeguinte).toEqual(controleOriginal)
    expect(seguinte).toEqual({
      ...dados,
      data: '2026-10-10',
      vencimento: '2026-10-12',
      status: 'PENDENTE',
      pagoEm: null,
    })
    expect(criada).toMatchObject({ id: 'saida-1', status: 'PAGO', serieId: controleOriginal!.serieId })
  })

  it('no dia 31, o mês seguinte cai no último dia do mês', async () => {
    const { saidas, categorias } = criarRepositorios()

    await new CriarSaida(saidas, categorias).execute(USER_ID, payload({ recorrente: true, data: '2026-08-31' }))

    expect(saidas.criar.mock.calls[1]![1]).toMatchObject({ data: '2026-09-30', vencimento: null })
  })

  it.each([
    ['Despesa Variável', CATEGORIAS.despesaVariavel.id],
    ['Investimento', CATEGORIAS.investimento.id],
  ])('rejeita recorrente na categoria %s com 422, sem gravar nada', async (_nome, categoriaId) => {
    const { saidas, categorias } = criarRepositorios()

    await expect(
      new CriarSaida(saidas, categorias).execute(USER_ID, payload({ recorrente: true, categoriaId })),
    ).rejects.toThrow(new ValidationError('Lançamento recorrente só é permitido na categoria Despesa Fixa.'))
    expect(saidas.criar).not.toHaveBeenCalled()
  })

  it.each([
    ['inexistente', 'cat-x'],
    ['de entrada', CATEGORIAS.rendaFixa.id],
  ])('rejeita categoria %s com 422', async (_caso, categoriaId) => {
    const { saidas, categorias } = criarRepositorios()

    await expect(new CriarSaida(saidas, categorias).execute(USER_ID, payload({ categoriaId }))).rejects.toThrow(
      new ValidationError('Categoria inválida.'),
    )
    expect(saidas.criar).not.toHaveBeenCalled()
  })

  it('propaga o erro quando o repositório rejeita', async () => {
    const { saidas, categorias } = criarRepositorios()
    const erro = new Error('falha no banco')
    saidas.criar.mockRejectedValueOnce(erro)

    await expect(new CriarSaida(saidas, categorias).execute(USER_ID, payload())).rejects.toBe(erro)
  })
})
