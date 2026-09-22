import { describe, expect, it } from 'vitest'

import { faixaDaPagina, montarPaginado } from '../../../src/shared/utils/paginacao'

describe('montarPaginado', () => {
  it('usa no mínimo 1 página quando o total é 0', () => {
    expect(montarPaginado([], 1, 20, 0)).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 })
  })

  it('arredonda o total de páginas para cima', () => {
    expect(montarPaginado([], 1, 20, 45).totalPages).toBe(3)
  })

  it('não cria página extra quando o total é múltiplo do tamanho da página', () => {
    expect(montarPaginado([], 1, 20, 40).totalPages).toBe(2)
  })

  it('retorna 1 página quando o total é 1', () => {
    expect(montarPaginado(['a'], 1, 20, 1).totalPages).toBe(1)
  })

  it('repassa page, pageSize, total e items sem alteração', () => {
    const items = [{ id: 1 }, { id: 2 }]

    expect(montarPaginado(items, 2, 5, 12)).toMatchObject({ items, page: 2, pageSize: 5, total: 12 })
  })
})

describe('faixaDaPagina', () => {
  it('retorna [0, 19] para a página 1 com 20 itens', () => {
    expect(faixaDaPagina(1, 20)).toEqual([0, 19])
  })

  it('retorna [20, 39] para a página 2 com 20 itens', () => {
    expect(faixaDaPagina(2, 20)).toEqual([20, 39])
  })

  it('retorna [20, 29] para a página 3 com 10 itens', () => {
    expect(faixaDaPagina(3, 10)).toEqual([20, 29])
  })

  it('retorna [0, 0] para a página 1 com 1 item', () => {
    expect(faixaDaPagina(1, 1)).toEqual([0, 0])
  })
})
