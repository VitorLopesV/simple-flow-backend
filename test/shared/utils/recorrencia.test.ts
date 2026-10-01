import { describe, expect, it } from 'vitest'

import type { CategoriaTipo } from '../../../src/domain/entities/Categoria'
import {
  categoriaPermiteRecorrencia,
  houveAlteracao,
  mesmoDiaNoMesSeguinte,
} from '../../../src/shared/utils/recorrencia'

describe('categoriaPermiteRecorrencia', () => {
  it.each<[CategoriaTipo, boolean]>([
    ['CONTA_FIXA', true],
    ['RENDA_FIXA', true],
    ['CONTA_VARIAVEL', false],
    ['RENDA_VARIAVEL', false],
    ['INVESTIMENTO', false],
    ['OUTROS', false],
  ])('%s → %s', (tipo, esperado) => {
    expect(categoriaPermiteRecorrencia({ tipo })).toBe(esperado)
  })
})

describe('mesmoDiaNoMesSeguinte', () => {
  it.each([
    ['2026-09-10', '2026-10-10'],
    ['2026-12-15', '2027-01-15'],
    ['2026-01-31', '2026-02-28'],
    ['2028-01-31', '2028-02-29'],
    ['2026-08-31', '2026-09-30'],
    ['2026-02-28', '2026-03-28'],
    ['2026-10-31', '2026-11-30'],
  ])('%s → %s', (data, esperado) => {
    expect(mesmoDiaNoMesSeguinte(data)).toBe(esperado)
  })
})

describe('houveAlteracao', () => {
  const atual = { valor: 100, descricao: 'Aluguel', observacao: null as string | null, vencimento: null as string | null }

  it('false quando todos os campos informados são iguais', () => {
    expect(houveAlteracao(atual, { valor: 100, descricao: 'Aluguel' })).toBe(false)
  })

  it('trata ausente e null como iguais', () => {
    expect(houveAlteracao(atual, { observacao: undefined, vencimento: null })).toBe(false)
  })

  it('true quando algum campo muda', () => {
    expect(houveAlteracao(atual, { valor: 101 })).toBe(true)
    expect(houveAlteracao(atual, { observacao: 'nota' })).toBe(true)
  })

  it('ignora campos do registro que não vieram nos dados', () => {
    expect(houveAlteracao(atual, {})).toBe(false)
  })
})
