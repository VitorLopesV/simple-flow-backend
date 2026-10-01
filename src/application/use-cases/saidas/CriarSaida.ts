import { randomUUID } from 'node:crypto'

import { ValidationError } from '../../../domain/errors/DomainError'
import type { Saida, SaidaPayload } from '../../../domain/entities/Saida'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID } from '../../../shared/types/common'
import { categoriaPermiteRecorrencia, mesmoDiaNoMesSeguinte } from '../../../shared/utils/recorrencia'

export const MENSAGEM_RECORRENCIA_SAIDA = 'Lançamento recorrente só é permitido na categoria Despesa Fixa.'

/** Mesma saída no mês seguinte, sempre pendente: cada mês da série é pago à parte. */
export function saidaDoMesSeguinte(payload: SaidaPayload): SaidaPayload {
  return {
    ...payload,
    data: mesmoDiaNoMesSeguinte(payload.data),
    vencimento: payload.vencimento ? mesmoDiaNoMesSeguinte(payload.vencimento) : null,
    status: 'PENDENTE',
    pagoEm: null,
  }
}

/**
 * Gasto no cartão de crédito não passa por aqui: ele é lançado direto no cartão
 * (ver `CriarTransacaoCartao`) e chega na aba Saídas como a fatura inteira, uma
 * saída derivada (ver `SupabaseSaidaRepository.listarDoPeriodo`). Por isso o
 * schema da rota não aceita `formaPagamento: 'CARTAO_CREDITO'`.
 *
 * Saída recorrente nasce com o registro do mês seguinte já gravado (ver
 * `saidaDoMesSeguinte`), independente do original; o job diário cria os próximos.
 */
export class CriarSaida {
  constructor(
    private readonly saidaRepository: SaidaRepository,
    private readonly categoriaRepository: CategoriaRepository,
  ) {}

  async execute(userId: ID, payload: SaidaPayload): Promise<Saida> {
    const categoria = await this.categoriaRepository.buscarPorId(userId, payload.categoriaId)
    if (categoria?.movimento !== 'SAIDA') throw new ValidationError('Categoria inválida.')
    if (payload.recorrente && !categoriaPermiteRecorrencia(categoria)) {
      throw new ValidationError(MENSAGEM_RECORRENCIA_SAIDA)
    }

    // `pagoEm` nunca vem do cliente: é definida aqui a partir da situação escolhida.
    const pagoEm = payload.status === 'PAGO' ? new Date().toISOString().slice(0, 10) : null
    const dados = { ...payload, pagoEm }

    if (!payload.recorrente) return this.saidaRepository.criar(userId, dados)

    const serieId = randomUUID()
    const saida = await this.saidaRepository.criar(userId, dados, { serieId })
    await this.saidaRepository.criar(userId, saidaDoMesSeguinte(dados), { serieId })
    return saida
  }
}
