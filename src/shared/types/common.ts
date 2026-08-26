/** Tipos transversais compartilhados por todos os domínios — espelha frontend/src/types/common.ts. */

export type ID = string

/** Período de competência (mês/ano) usado em filtros. */
export interface Periodo {
  /** 1-12 */
  mes: number
  /** Ex.: 2026 */
  ano: number
}

export interface PageRequest {
  page: number
  pageSize: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Ponto de uma série temporal usado nos gráficos do dashboard. */
export interface SeriePonto {
  label: string
  valor: number
}

/** Usuário autenticado, anexado à requisição pelo authMiddleware. */
export interface UsuarioAutenticado {
  id: ID
  email: string
  nome: string | null
}
