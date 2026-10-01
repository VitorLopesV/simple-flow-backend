/** Erro base de domínio/aplicação — o errorHandler mapeia subclasses para status HTTP. */
export abstract class DomainError extends Error {
  abstract readonly status: number
  /** Campos extras devolvidos junto com `message` no corpo da resposta (ex.: `mesesAfetados`). */
  readonly detalhes?: Record<string, unknown>

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class NotFoundError extends DomainError {
  readonly status = 404

  constructor(recurso: string) {
    super(`${recurso} não encontrado.`)
  }
}

export class ValidationError extends DomainError {
  readonly status = 422

  constructor(message = 'Dados inválidos.') {
    super(message)
  }
}

export class UnauthorizedError extends DomainError {
  readonly status = 401

  constructor(message = 'Não autenticado.') {
    super(message)
  }
}

export class ConflictError extends DomainError {
  readonly status = 409

  constructor(message = 'Conflito ao processar a solicitação.') {
    super(message)
  }
}

/**
 * Encerrar uma série (excluir um mês ou desligar a recorrência) remove os meses
 * seguintes — se algum deles foi alterado pelo usuário, nada é removido sem a
 * confirmação explícita (`?confirmar=true`). `mesesAfetados` lista as competências.
 */
export class SerieAlteradaError extends ConflictError {
  override readonly detalhes: { mesesAfetados: string[] }

  constructor(mesesAfetados: string[]) {
    super(
      `Os meses seguintes desta série foram alterados (${mesesAfetados.join(', ')}). ` +
        'Confirme para removê-los; os meses anteriores não são afetados.',
    )
    this.detalhes = { mesesAfetados }
  }
}
