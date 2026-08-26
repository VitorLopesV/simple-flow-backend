import type { Paginated } from '../types/common'

export function montarPaginado<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): Paginated<T> {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** Índices `[de, ate]` (inclusive, base 0) para `.range()` do PostgREST. */
export function faixaDaPagina(page: number, pageSize: number): [number, number] {
  const de = (page - 1) * pageSize
  return [de, de + pageSize - 1]
}
