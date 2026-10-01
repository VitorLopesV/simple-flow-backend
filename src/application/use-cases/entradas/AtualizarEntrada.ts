import { randomUUID } from 'node:crypto'

import { NotFoundError, SerieAlteradaError, ValidationError } from '../../../domain/errors/DomainError'
import type { Entrada, EntradaPayload } from '../../../domain/entities/Entrada'
import type { OpcoesDeEncerramento } from '../../../domain/entities/Recorrencia'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID } from '../../../shared/types/common'
import {
  categoriaPermiteRecorrencia,
  houveAlteracao,
  mesesAlterados,
  mesmoDiaNoMesSeguinte,
} from '../../../shared/utils/recorrencia'
import { MENSAGEM_RECORRENCIA_ENTRADA } from './CriarEntrada'

/**
 * Edita só o registro informado — os outros meses da série não mudam. Duas exceções:
 * desligar a recorrência (inclusive trocando para categoria não fixa) encerra a série
 * e remove os meses seguintes (com confirmação se algum foi alterado); religar volta
 * a gerar o mês seguinte.
 */
export class AtualizarEntrada {
  constructor(
    private readonly entradaRepository: EntradaRepository,
    private readonly categoriaRepository: CategoriaRepository,
  ) {}

  async execute(userId: ID, id: ID, payload: EntradaPayload, opcoes: OpcoesDeEncerramento = {}): Promise<Entrada> {
    const atual = await this.entradaRepository.buscarPorId(userId, id)
    if (!atual) throw new NotFoundError('Entrada')

    const categoria = await this.categoriaRepository.buscarPorId(userId, payload.categoriaId)
    if (categoria?.movimento !== 'ENTRADA') throw new ValidationError('Categoria inválida.')

    const permiteRecorrencia = categoriaPermiteRecorrencia(categoria)
    if (payload.recorrente && !permiteRecorrencia && !atual.recorrente) {
      throw new ValidationError(MENSAGEM_RECORRENCIA_ENTRADA)
    }

    // Trocar uma entrada recorrente para uma categoria não fixa desliga a recorrência.
    const recorrente = payload.recorrente && permiteRecorrencia
    // Nome de uma entrada recorrente é fixo — só muda quando ela deixa de ser recorrente.
    const descricao = atual.recorrente && recorrente ? atual.descricao : payload.descricao
    const dados = { ...payload, recorrente, descricao }
    const editadoManualmente = atual.editadoManualmente || houveAlteracao(atual, dados)

    if (atual.recorrente && !recorrente && atual.serieId) {
      const seguintes = await this.entradaRepository.listarSeguintesDaSerie(userId, atual.serieId, atual.data)
      const alterados = mesesAlterados(seguintes)
      if (alterados.length > 0 && !opcoes.confirmar) throw new SerieAlteradaError(alterados)

      if (seguintes.length > 0) {
        await this.entradaRepository.removerVarios(
          userId,
          seguintes.map((entrada) => entrada.id),
        )
      }
      await this.entradaRepository.marcarSerieEncerrada(userId, atual.serieId, true)
      return this.entradaRepository.atualizar(userId, id, dados, { editadoManualmente })
    }

    if (!atual.recorrente && recorrente) {
      const serieId = atual.serieId ?? randomUUID()
      const entrada = await this.entradaRepository.atualizar(userId, id, dados, { serieId, editadoManualmente })
      await this.entradaRepository.marcarSerieEncerrada(userId, serieId, false)

      const seguintes = await this.entradaRepository.listarSeguintesDaSerie(userId, serieId, entrada.data)
      if (seguintes.length === 0) {
        await this.entradaRepository.criar(userId, { ...dados, data: mesmoDiaNoMesSeguinte(entrada.data) }, { serieId })
      }
      return entrada
    }

    return this.entradaRepository.atualizar(userId, id, dados, { editadoManualmente })
  }
}
