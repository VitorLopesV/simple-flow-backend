import { NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { TransacaoCartao, TransacaoCartaoPayload } from '../../../domain/entities/Fatura'
import type { CartaoRepository } from '../../../domain/repositories/CartaoRepository'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { FaturaRepository } from '../../../domain/repositories/FaturaRepository'
import type { ID } from '../../../shared/types/common'
import { categoriaPermiteRecorrencia, houveAlteracao } from '../../../shared/utils/recorrencia'
import { MENSAGEM_RECORRENCIA_SAIDA } from '../saidas/CriarSaida'
import { datasDaFatura } from './CriarTransacaoCartao'

/**
 * Editar a data pode mover o débito para a fatura de outra competência. Só o débito
 * informado muda — os outros meses da série não.
 */
export class AtualizarTransacaoCartao {
  constructor(
    private readonly cartaoRepository: CartaoRepository,
    private readonly faturaRepository: FaturaRepository,
    private readonly categoriaRepository: CategoriaRepository,
  ) {}

  async execute(userId: ID, id: ID, payload: TransacaoCartaoPayload): Promise<TransacaoCartao> {
    const atual = await this.faturaRepository.buscarTransacaoPorId(userId, id)
    if (!atual) throw new NotFoundError('Transação do cartão')

    const cartao = await this.cartaoRepository.buscarPorId(userId, atual.cartaoId)
    if (!cartao) throw new NotFoundError('Cartão')

    const categoria = await this.categoriaRepository.buscarPorId(userId, payload.categoriaId)
    if (categoria?.movimento !== 'SAIDA') throw new ValidationError('Categoria inválida.')

    const permiteRecorrencia = categoriaPermiteRecorrencia(categoria)
    if (payload.recorrente && !permiteRecorrencia && !atual.recorrente) {
      throw new ValidationError(MENSAGEM_RECORRENCIA_SAIDA)
    }

    // Trocar um débito recorrente para uma categoria não fixa desliga a recorrência.
    const recorrente = payload.recorrente && permiteRecorrencia
    // Nome de um débito recorrente é fixo — só muda quando ele deixa de ser recorrente.
    const descricao = atual.recorrente && recorrente ? atual.descricao : payload.descricao
    const dados = { ...payload, recorrente, descricao }

    return this.faturaRepository.atualizarTransacao(userId, id, dados, datasDaFatura(cartao, dados.data), {
      editadoManualmente: atual.editadoManualmente || houveAlteracao(atual, dados),
    })
  }
}
