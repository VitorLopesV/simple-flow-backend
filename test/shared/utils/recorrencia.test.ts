import { describe, expect, it } from 'vitest'

import {
  chaveDaSerieDoItem,
  origemDoIdProjetado,
  projetarRecorrencias,
} from '../../../src/shared/utils/recorrencia'

const UUID = '123e4567-e89b-12d3-a456-426614174000'

interface ItemDeTeste {
  id: string
  data: string
  descricao: string
  categoriaId: string
  recorrente: boolean
  valor: number
  automatica?: boolean
  vencimento?: string | null
}

function item(sobrescritas: Partial<ItemDeTeste> = {}): ItemDeTeste {
  return {
    id: 'a',
    data: '2026-08-10',
    descricao: 'Aluguel',
    categoriaId: 'cat-1',
    recorrente: true,
    valor: 1500,
    ...sobrescritas,
  }
}

const SETEMBRO_2026 = { ano: 2026, mes: 9 }

describe('projetarRecorrencias', () => {
  it('projeta item recorrente de mês anterior no mês alvo', () => {
    const resultado = projetarRecorrencias([item()], new Set(), SETEMBRO_2026)

    expect(resultado).toHaveLength(1)
    expect(resultado[0]).toMatchObject({
      id: 'a_2026-09',
      data: '2026-09-10',
      origemRecorrenciaId: 'a',
    })
  })

  it('ignora item com recorrente false', () => {
    expect(projetarRecorrencias([item({ recorrente: false })], new Set(), SETEMBRO_2026)).toEqual([])
  })

  it('ignora item com automatica true', () => {
    expect(projetarRecorrencias([item({ automatica: true })], new Set(), SETEMBRO_2026)).toEqual([])
  })

  it('ignora item do próprio período alvo ou de período posterior', () => {
    const candidatas = [item({ id: 'a', data: '2026-09-05' }), item({ id: 'b', data: '2026-10-05' })]

    expect(projetarRecorrencias(candidatas, new Set(), SETEMBRO_2026)).toEqual([])
  })

  it('projeta só a ocorrência mais recente de uma mesma série', () => {
    const candidatas = [
      item({ id: 'antiga', data: '2026-06-10' }),
      item({ id: 'recente', data: '2026-08-15' }),
      item({ id: 'meio', data: '2026-07-20' }),
    ]

    const resultado = projetarRecorrencias(candidatas, new Set(), SETEMBRO_2026)

    expect(resultado).toHaveLength(1)
    expect(resultado[0]).toMatchObject({ id: 'recente_2026-09', data: '2026-09-15', origemRecorrenciaId: 'recente' })
  })

  it('projeta uma ocorrência por série quando a descrição é a mesma com categorias diferentes', () => {
    const candidatas = [item({ id: 'a', categoriaId: 'cat-1' }), item({ id: 'b', categoriaId: 'cat-2' })]

    const resultado = projetarRecorrencias(candidatas, new Set(), SETEMBRO_2026)

    expect(resultado.map((projetado) => projetado.origemRecorrenciaId).sort()).toEqual(['a', 'b'])
  })

  it('não projeta série cuja chave já foi lançada no período', () => {
    const jaLancadas = new Set(['Aluguel::cat-1'])

    expect(projetarRecorrencias([item()], jaLancadas, SETEMBRO_2026)).toEqual([])
  })

  it('retorna lista vazia quando não há candidatas', () => {
    expect(projetarRecorrencias([], new Set(), SETEMBRO_2026)).toEqual([])
  })

  it('ajusta origem no dia 31 para o último dia de fevereiro (28 em 2026, 29 em 2024)', () => {
    const em2026 = projetarRecorrencias([item({ data: '2026-01-31' })], new Set(), { ano: 2026, mes: 2 })
    const em2024 = projetarRecorrencias([item({ data: '2024-01-31' })], new Set(), { ano: 2024, mes: 2 })

    expect(em2026[0]!.data).toBe('2026-02-28')
    expect(em2024[0]!.data).toBe('2024-02-29')
  })

  it('projeta origem de dezembro para janeiro do ano seguinte', () => {
    const resultado = projetarRecorrencias([item({ data: '2025-12-10' })], new Set(), { ano: 2026, mes: 1 })

    expect(resultado[0]).toMatchObject({ id: 'a_2026-01', data: '2026-01-10' })
  })

  it('projeta o vencimento para o mês alvo, ajustando o dia ao último do mês', () => {
    const resultado = projetarRecorrencias(
      [item({ data: '2026-01-05', vencimento: '2026-01-31' })],
      new Set(),
      { ano: 2026, mes: 2 },
    )

    expect(resultado[0]).toMatchObject({ data: '2026-02-05', vencimento: '2026-02-28' })
  })

  it('não define vencimento quando a origem não tem vencimento ou tem vencimento null', () => {
    const semCampo = projetarRecorrencias([item()], new Set(), SETEMBRO_2026)
    const comNull = projetarRecorrencias([item({ vencimento: null })], new Set(), SETEMBRO_2026)

    expect(semCampo[0]).not.toHaveProperty('vencimento')
    expect(comNull[0]!.vencimento).toBeNull()
  })

  it('preserva descrição, categoria e valor da origem', () => {
    const resultado = projetarRecorrencias([item()], new Set(), SETEMBRO_2026)

    expect(resultado[0]).toMatchObject({ descricao: 'Aluguel', categoriaId: 'cat-1', valor: 1500 })
  })

  it('aplica os campos de sobrescrever na ocorrência projetada, sem alterar a origem', () => {
    const origem = item({ valor: 1500 })

    const [projetada] = projetarRecorrencias([origem], new Set(), SETEMBRO_2026, { valor: 0 })

    expect(projetada).toMatchObject({ id: 'a_2026-09', valor: 0, origemRecorrenciaId: 'a' })
    expect(origem.valor).toBe(1500)
  })

  it('não deixa sobrescrever apagar o vínculo com a origem', () => {
    const [projetada] = projetarRecorrencias([item()], new Set(), SETEMBRO_2026, {
      origemRecorrenciaId: 'outra',
    } as Partial<ItemDeTeste>)

    expect(projetada!.origemRecorrenciaId).toBe('a')
  })
})

describe('chaveDaSerieDoItem', () => {
  it('retorna descricao::categoriaId', () => {
    expect(chaveDaSerieDoItem({ descricao: 'Aluguel', categoriaId: 'cat-1' })).toBe('Aluguel::cat-1')
  })
})

describe('origemDoIdProjetado', () => {
  it('extrai origem e competência de um id projetado', () => {
    expect(origemDoIdProjetado(`${UUID}_2026-09`)).toEqual({ origemId: UUID, competencia: '2026-09' })
  })

  it('retorna null para UUID puro', () => {
    expect(origemDoIdProjetado(UUID)).toBeNull()
  })

  it('retorna null para id de saída derivada de fatura', () => {
    expect(origemDoIdProjetado(`sai_fat_${UUID}`)).toBeNull()
  })

  it('preserva underscores na origem', () => {
    expect(origemDoIdProjetado('a_b_2026-09')).toEqual({ origemId: 'a_b', competencia: '2026-09' })
  })
})
