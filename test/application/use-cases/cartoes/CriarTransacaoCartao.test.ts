import { describe, expect, it, vi } from 'vitest'

import { CriarTransacaoCartao } from '../../../../src/application/use-cases/cartoes/CriarTransacaoCartao'
import type { Cartao } from '../../../../src/domain/entities/Cartao'
import type { TransacaoCartao, TransacaoCartaoPayload } from '../../../../src/domain/entities/Fatura'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import type { CartaoRepository } from '../../../../src/domain/repositories/CartaoRepository'
import type { FaturaRepository } from '../../../../src/domain/repositories/FaturaRepository'

const USER_ID = 'user-1'
const CARTAO_ID = 'cartao-1'

function cartao(sobrescritas: Partial<Cartao> = {}): Cartao {
  return {
    id: CARTAO_ID,
    nome: 'Nubank',
    bandeira: 'MASTERCARD',
    ultimosDigitos: '1234',
    limite: 5000,
    diaFechamento: 10,
    diaVencimento: 20,
    cor: '#820ad1',
    ativo: true,
    criadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

function payload(sobrescritas: Partial<TransacaoCartaoPayload> = {}): TransacaoCartaoPayload {
  return {
    descricao: 'Mercado',
    valor: 200,
    data: '2026-09-15',
    categoriaId: 'cat-1',
    tipo: 'ALIMENTACAO',
    parcelaAtual: 1,
    totalParcelas: 1,
    recorrente: false,
    ...sobrescritas,
  }
}

const transacaoCriada: TransacaoCartao = {
  ...payload(),
  id: 'transacao-1',
  cartaoId: CARTAO_ID,
  faturaId: 'fatura-1',
  criadoEm: '2026-09-15T12:00:00.000Z',
  atualizadoEm: '2026-09-15T12:00:00.000Z',
}

function criarRepositorios(cartaoExistente: Cartao | null) {
  const cartaoRepository = {
    listar: vi.fn(),
    buscarPorId: vi.fn(async () => cartaoExistente),
    criar: vi.fn(),
    atualizar: vi.fn(),
    remover: vi.fn(),
  } satisfies CartaoRepository

  const faturaRepository = {
    listarComFaturas: vi.fn(),
    listarVencendoNoPeriodo: vi.fn(),
    pagar: vi.fn(),
    buscarTransacaoPorId: vi.fn(),
    criarTransacao: vi.fn(async () => transacaoCriada),
    atualizarTransacao: vi.fn(),
    removerTransacao: vi.fn(),
  } satisfies FaturaRepository

  return { cartaoRepository, faturaRepository }
}

describe('CriarTransacaoCartao', () => {
  it('lança NotFoundError para cartão inexistente sem chamar criarTransacao', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(null)

    const promessa = new CriarTransacaoCartao(cartaoRepository, faturaRepository).execute(
      USER_ID,
      CARTAO_ID,
      payload(),
    )

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
    expect(faturaRepository.criarTransacao).not.toHaveBeenCalled()
  })

  it('busca o cartão com userId e cartaoId', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(cartao())

    await new CriarTransacaoCartao(cartaoRepository, faturaRepository).execute(USER_ID, CARTAO_ID, payload())

    expect(cartaoRepository.buscarPorId).toHaveBeenCalledWith(USER_ID, CARTAO_ID)
  })

  it('lança a transação na competência da data com fechamento dia 10 e vencimento dia 20', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(cartao({ diaFechamento: 10, diaVencimento: 20 }))
    const dados = payload({ data: '2026-09-15' })

    await new CriarTransacaoCartao(cartaoRepository, faturaRepository).execute(USER_ID, CARTAO_ID, dados)

    expect(faturaRepository.criarTransacao).toHaveBeenCalledWith(USER_ID, CARTAO_ID, dados, {
      competencia: '2026-09',
      fechamento: '2026-09-10',
      vencimento: '2026-09-20',
    })
  })

  it('joga o vencimento para o mês seguinte quando é menor ou igual ao fechamento', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(cartao({ diaFechamento: 25, diaVencimento: 5 }))
    const dados = payload({ data: '2026-09-15' })

    await new CriarTransacaoCartao(cartaoRepository, faturaRepository).execute(USER_ID, CARTAO_ID, dados)

    expect(faturaRepository.criarTransacao).toHaveBeenCalledWith(USER_ID, CARTAO_ID, dados, {
      competencia: '2026-09',
      fechamento: '2026-09-25',
      vencimento: '2026-10-05',
    })
  })

  it('usa competência 2026-12 e vencimento em janeiro de 2027 para data de dezembro', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(cartao({ diaFechamento: 25, diaVencimento: 5 }))
    const dados = payload({ data: '2026-12-20' })

    await new CriarTransacaoCartao(cartaoRepository, faturaRepository).execute(USER_ID, CARTAO_ID, dados)

    expect(faturaRepository.criarTransacao).toHaveBeenCalledWith(
      USER_ID,
      CARTAO_ID,
      dados,
      expect.objectContaining({ competencia: '2026-12', vencimento: '2027-01-05' }),
    )
  })

  it('devolve a transação retornada pelo repositório', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(cartao())

    const resultado = await new CriarTransacaoCartao(cartaoRepository, faturaRepository).execute(
      USER_ID,
      CARTAO_ID,
      payload(),
    )

    expect(resultado).toBe(transacaoCriada)
  })
})
