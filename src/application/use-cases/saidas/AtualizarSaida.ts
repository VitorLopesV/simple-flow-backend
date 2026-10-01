import { ConflictError, NotFoundError, ValidationError } from '../../../domain/errors/DomainError'
import type { Saida, SaidaPayload } from '../../../domain/entities/Saida'
import type { CategoriaRepository } from '../../../domain/repositories/CategoriaRepository'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { ID } from '../../../shared/types/common'
import { categoriaPermiteRecorrencia, houveAlteracao } from '../../../shared/utils/recorrencia'
import { MENSAGEM_RECORRENCIA_SAIDA } from './CriarSaida'

/** Edita só o registro informado — os outros meses da série não mudam. */
export class AtualizarSaida {
  constructor(
    private readonly saidaRepository: SaidaRepository,
    private readonly categoriaRepository: CategoriaRepository,
  ) {}

  async execute(userId: ID, id: ID, payload: SaidaPayload): Promise<Saida> {
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

    return this.saidaRepository.atualizar(userId, id, dados, {
      editadoManualmente: atual.editadoManualmente || houveAlteracao(atual, dados),
    })
  }
}
