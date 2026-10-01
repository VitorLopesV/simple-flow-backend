import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { Entrada, EntradaPayload } from '../../../domain/entities/Entrada'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { EntradaRepository } from '../../../domain/repositories/EntradaRepository'
import type { ID } from '../../../shared/types/common'
import { categoriaPermiteRecorrencia, houveAlteracao } from '../../../shared/utils/recorrencia'
import { MENSAGEM_RECORRENCIA_ENTRADA } from './CriarEntrada'

/** Edita só o registro informado — os outros meses da série não mudam. */
export class AtualizarEntrada {
  constructor(
    private readonly entradaRepository: EntradaRepository,
    private readonly categoriaRepository: CategoriaRepository,
  ) {}

  async execute(userId: ID, id: ID, payload: EntradaPayload): Promise<Entrada> {
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

    return this.entradaRepository.atualizar(userId, id, dados, {
      editadoManualmente: atual.editadoManualmente || houveAlteracao(atual, dados),
    })
  }
}
