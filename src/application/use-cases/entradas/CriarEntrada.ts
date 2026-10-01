import { randomUUID } from 'node:crypto'

import { ValidationError } from '../../../domain/errors/DomainError'
import type { Entrada, EntradaPayload } from '../../../domain/entities/Entrada'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID } from '../../../shared/types/common'
import { categoriaPermiteRecorrencia, mesmoDiaNoMesSeguinte } from '../../../shared/utils/recorrencia'

export const MENSAGEM_RECORRENCIA_ENTRADA = 'Lançamento recorrente só é permitido na categoria Renda Fixa.'

/**
 * Entrada recorrente nasce com o registro do mês seguinte já gravado (mesmo dia,
 * limitado ao fim do mês): os dois pertencem à mesma série, mas são independentes —
 * editar um não altera o outro. Daí em diante, o job diário cria os próximos meses.
 */
export class CriarEntrada {
  constructor(
    private readonly entradaRepository: EntradaRepository,
    private readonly categoriaRepository: CategoriaRepository,
  ) {}

  async execute(userId: ID, payload: EntradaPayload): Promise<Entrada> {
    const categoria = await this.categoriaRepository.buscarPorId(userId, payload.categoriaId)
    if (categoria?.movimento !== 'ENTRADA') throw new ValidationError('Categoria inválida.')
    if (payload.recorrente && !categoriaPermiteRecorrencia(categoria)) {
      throw new ValidationError(MENSAGEM_RECORRENCIA_ENTRADA)
    }

    if (!payload.recorrente) return this.entradaRepository.criar(userId, payload)

    const serieId = randomUUID()
    const entrada = await this.entradaRepository.criar(userId, payload, { serieId })
    await this.entradaRepository.criar(userId, { ...payload, data: mesmoDiaNoMesSeguinte(payload.data) }, { serieId })
    return entrada
  }
}
