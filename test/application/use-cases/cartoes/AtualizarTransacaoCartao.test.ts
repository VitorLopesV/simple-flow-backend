import { describe, expect, it, vi } from 'vitest'

import { AtualizarTransacaoCartao } from '../../../../src/application/use-cases/cartoes/AtualizarTransacaoCartao'
import type { Cartao } from '../../../../src/domain/entities/Cartao'
import type { TransacaoCartao, TransacaoCartaoPayload } from '../../../../src/domain/entities/Fatura'
import { NotFoundError } from '../../../../src/domain/errors/DomainError'
import type { CartaoRepository } from '../../../../src/domain/repositories/CartaoRepository'
import type { FaturaRepository } from '../../../../src/domain/repositories/FaturaRepository'

const USER_ID = 'user-1'
const TRANSACAO_ID = 'transacao-1'
const CARTAO_ID = 'cartao-1'

const cartao: Cartao = {
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

const transacaoAtual: TransacaoCartao = {
  ...payload(),
  id: TRANSACAO_ID,
  cartaoId: CARTAO_ID,
  faturaId: 'fatura-1',
  criadoEm: '2026-09-15T12:00:00.000Z',
  atualizadoEm: '2026-09-15T12:00:00.000Z',
}

const transacaoAtualizada: TransacaoCartao = { ...transacaoAtual, atualizadoEm: '2026-09-16T12:00:00.000Z' }

function criarRepositorios(transacaoExistente: TransacaoCartao | null, cartaoExistente: Cartao | null) {
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
    buscarTransacaoPorId: vi.fn(async () => transacaoExistente),
    criarTransacao: vi.fn(),
    atualizarTransacao: vi.fn(async () => transacaoAtualizada),
    removerTransacao: vi.fn(),
  } satisfies FaturaRepository

  return { cartaoRepository, faturaRepository }
}

describe('AtualizarTransacaoCartao', () => {
  it('lança NotFoundError para transação inexistente sem consultar o CartaoRepository', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(null, cartao)

    const promessa = new AtualizarTransacaoCartao(cartaoRepository, faturaRepository).execute(
      USER_ID,
      TRANSACAO_ID,
      payload(),
    )

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
    expect(cartaoRepository.buscarPorId).not.toHaveBeenCalled()
  })

  it('lança NotFoundError quando o cartão da transação não existe sem chamar atualizarTransacao', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(transacaoAtual, null)

    const promessa = new AtualizarTransacaoCartao(cartaoRepository, faturaRepository).execute(
      USER_ID,
      TRANSACAO_ID,
      payload(),
    )

    await expect(promessa).rejects.toBeInstanceOf(NotFoundError)
    await expect(promessa).rejects.toMatchObject({ status: 404 })
    expect(faturaRepository.atualizarTransacao).not.toHaveBeenCalled()
  })

  it('busca o cartão pelo cartaoId da transação atual e não pelo id da rota', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(transacaoAtual, cartao)

    await new AtualizarTransacaoCartao(cartaoRepository, faturaRepository).execute(USER_ID, TRANSACAO_ID, payload())

    expect(cartaoRepository.buscarPorId).toHaveBeenCalledWith(USER_ID, CARTAO_ID)
    expect(cartaoRepository.buscarPorId).not.toHaveBeenCalledWith(USER_ID, TRANSACAO_ID)
  })

  it('atualiza a transação com competência e datas corretas quando a data continua no mesmo mês', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(transacaoAtual, cartao)
    const dados = payload({ data: '2026-09-18', valor: 250 })

    await new AtualizarTransacaoCartao(cartaoRepository, faturaRepository).execute(USER_ID, TRANSACAO_ID, dados)

    expect(faturaRepository.atualizarTransacao).toHaveBeenCalledWith(USER_ID, TRANSACAO_ID, dados, {
      competencia: '2026-09',
      fechamento: '2026-09-10',
      vencimento: '2026-09-20',
    })
  })

  it('recalcula competência e datas quando a data é movida para outro mês', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(transacaoAtual, cartao)
    const dados = payload({ data: '2026-11-03' })

    await new AtualizarTransacaoCartao(cartaoRepository, faturaRepository).execute(USER_ID, TRANSACAO_ID, dados)

    expect(faturaRepository.atualizarTransacao).toHaveBeenCalledWith(USER_ID, TRANSACAO_ID, dados, {
      competencia: '2026-11',
      fechamento: '2026-11-10',
      vencimento: '2026-11-20',
    })
  })

  it('devolve a transação retornada pelo repositório', async () => {
    const { cartaoRepository, faturaRepository } = criarRepositorios(transacaoAtual, cartao)

    const resultado = await new AtualizarTransacaoCartao(cartaoRepository, faturaRepository).execute(
      USER_ID,
      TRANSACAO_ID,
      payload(),
    )

    expect(resultado).toBe(transacaoAtualizada)
  })
})
