/** Erro base de domínio/aplicação — o errorHandler mapeia subclasses para status HTTP. */
export abstract class DomainError extends Error {
  abstract readonly status: number

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
