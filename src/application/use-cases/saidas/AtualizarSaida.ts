import { randomUUID } from 'node:crypto'

import { ConflictError, NotFoundError, SerieAlteradaError, ValidationError } from '../../../domain/errors/DomainError'
import type { OpcoesDeEncerramento } from '../../../domain/entities/Recorrencia'
import type { Saida, SaidaPayload } from '../../../domain/entities/Saida'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID } from '../../../shared/types/common'
import { categoriaPermiteRecorrencia, houveAlteracao, mesesAlterados } from '../../../shared/utils/recorrencia'
import { MENSAGEM_RECORRENCIA_SAIDA, saidaDoMesSeguinte } from './CriarSaida'

/**
 * Edita só o registro informado — os outros meses da série não mudam. Duas exceções:
 * desligar a recorrência (inclusive trocando para categoria não fixa) encerra a série
 * e remove os meses seguintes (com confirmação se algum foi alterado — marcar como
 * PAGO conta como alteração); religar volta a gerar o mês seguinte.
 */
export class AtualizarSaida {
  constructor(
    private readonly saidaRepository: SaidaRepository,
    private readonly categoriaRepository: CategoriaRepository,
  ) {}

  async execute(userId: ID, id: ID, payload: SaidaPayload, opcoes: OpcoesDeEncerramento = {}): Promise<Saida> {
    const atual = await this.saidaRepository.buscarPorId(userId, id)
    if (!atual) throw new NotFoundError('Saída')

    if (atual.automatica) {
      throw new ConflictError(
        'Esta saída foi gerada automaticamente pela fatura do cartão e não pode ser editada diretamente.',
      )
    }

    const categoria = await this.categoriaRepository.buscarPorId(userId, payload.categoriaId)
    if (categoria?.movimento !== 'SAIDA') throw new ValidationError('Categoria inválida.')

    const permiteRecorrencia = categoriaPermiteRecorrencia(categoria)
    if (payload.recorrente && !permiteRecorrencia && !atual.recorrente) {
      throw new ValidationError(MENSAGEM_RECORRENCIA_SAIDA)
    }

    // `pagoEm` nunca vem do cliente: passa a valer hoje quando a situação muda para
    // 'PAGO', mantém a data original se já estava paga (edição não deve "repagar"
    // a conta) e é limpa quando a situação volta para 'PENDENTE'.
    const pagoEm =
      payload.status !== 'PAGO'
        ? null
        : (atual.status === 'PAGO' ? atual.pagoEm : null) ?? new Date().toISOString().slice(0, 10)

    // Trocar uma saída recorrente para uma categoria não fixa desliga a recorrência.
    const recorrente = payload.recorrente && permiteRecorrencia
    // Nome de uma saída recorrente é fixo — só muda quando ela deixa de ser recorrente.
    const descricao = atual.recorrente && recorrente ? atual.descricao : payload.descricao
    const dados = { ...payload, recorrente, descricao, pagoEm }
    const editadoManualmente = atual.editadoManualmente || houveAlteracao(atual, dados)

    if (atual.recorrente && !recorrente && atual.serieId) {
      const seguintes = await this.saidaRepository.listarSeguintesDaSerie(userId, atual.serieId, atual.data)
      const alterados = mesesAlterados(seguintes)
      if (alterados.length > 0 && !opcoes.confirmar) throw new SerieAlteradaError(alterados)

      if (seguintes.length > 0) {
        await this.saidaRepository.removerVarios(
          userId,
          seguintes.map((saida) => saida.id),
        )
      }
      await this.saidaRepository.marcarSerieEncerrada(userId, atual.serieId, true)
      return this.saidaRepository.atualizar(userId, id, dados, { editadoManualmente })
    }

    if (!atual.recorrente && recorrente) {
      const serieId = atual.serieId ?? randomUUID()
      const saida = await this.saidaRepository.atualizar(userId, id, dados, { serieId, editadoManualmente })
      await this.saidaRepository.marcarSerieEncerrada(userId, serieId, false)

      const seguintes = await this.saidaRepository.listarSeguintesDaSerie(userId, serieId, saida.data)
      if (seguintes.length === 0) {
        await this.saidaRepository.criar(userId, saidaDoMesSeguinte({ ...dados, data: saida.data }), { serieId })
      }
      return saida
    }

    return this.saidaRepository.atualizar(userId, id, dados, { editadoManualmente })
  }
}
