import { describe, expect, it } from 'vitest'

import { rotinaPayloadSchema } from '../../../../src/presentation/http/schemas/rotina.schema'

const POR_DIAS = { modo: 'DIAS_DA_SEMANA', dias: [3, 1, 3] }
const POR_INTERVALO = { modo: 'A_CADA_N_DIAS', intervalo: 2, dataInicial: '2026-11-16' }
const base = (extra: Record<string, unknown> = {}) => ({ nome: ' Remédio ', repeticao: POR_DIAS, vezes: [{ hora: '08:00' }], ...extra })
const mensagem = (entrada: unknown) => {
  const r = rotinaPayloadSchema.safeParse(entrada)
  return r.success ? null : r.error.issues[0]!.message
}

describe('rotinaPayloadSchema', () => {
  it('aceita dias da semana: tira repetidos, ordena e apara o nome', () => {
    expect(rotinaPayloadSchema.parse(base())).toEqual({
      nome: 'Remédio',
      repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 3] },
      vezes: [{ hora: '08:00' }],
    })
  })

  it('aceita a cada N dias e vez sem hora (ausente ou null)', () => {
    const r = rotinaPayloadSchema.parse(base({ repeticao: POR_INTERVALO, vezes: [{}, { hora: '20:30' }] }))
    expect(r.repeticao).toEqual(POR_INTERVALO)
    expect(r.vezes).toEqual([{ hora: null }, { hora: '20:30' }])
  })

  it('exige pelo menos um dia no modo dias da semana, entre 1 e 5', () => {
    expect(mensagem(base({ repeticao: { modo: 'DIAS_DA_SEMANA', dias: [] } }))).toBe('Marque pelo menos um dia da semana.')
    expect(mensagem(base({ repeticao: { modo: 'DIAS_DA_SEMANA' } }))).toBe('Marque pelo menos um dia da semana.')
    expect(mensagem(base({ repeticao: { modo: 'DIAS_DA_SEMANA', dias: [0] } }))).toMatch(/Dia da semana inválido/)
    expect(mensagem(base({ repeticao: { modo: 'DIAS_DA_SEMANA', dias: [6] } }))).toMatch(/Dia da semana inválido/)
    expect(mensagem(base({ repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1.5] } }))).toMatch(/Dia da semana inválido/)
    expect(mensagem(base({ repeticao: { modo: 'DIAS_DA_SEMANA', dias: ['1'] } }))).toMatch(/Dia da semana inválido/)
  })

  it('exige N >= 1 inteiro e data inicial válida no modo a cada N dias', () => {
    const com = (campos: Record<string, unknown>) => base({ repeticao: { ...POR_INTERVALO, ...campos } })
    expect(mensagem(com({ intervalo: 0 }))).toBe('Informe o intervalo em dias (mínimo 1).')
    expect(mensagem(com({ intervalo: 1.5 }))).toBe('Informe o intervalo em dias (mínimo 1).')
    expect(mensagem(com({ intervalo: undefined }))).toBe('Informe o intervalo em dias (mínimo 1).')
    expect(mensagem(com({ intervalo: 366 }))).toBe('O intervalo pode ter no máximo 365 dias.')
    expect(mensagem(com({ dataInicial: undefined }))).toBe('Informe a data inicial.')
    expect(mensagem(com({ dataInicial: '16/11/2026' }))).toBe('Data inicial inválida, use o formato YYYY-MM-DD.')
    expect(mensagem(com({ dataInicial: '2026-02-31' }))).toBe('Data inicial inválida, use o formato YYYY-MM-DD.')
    expect(rotinaPayloadSchema.safeParse(com({ intervalo: 1 })).success).toBe(true)
    expect(rotinaPayloadSchema.safeParse(com({ dataInicial: '2028-02-29' })).success).toBe(true)
  })

  it('rejeita modo ausente ou desconhecido', () => {
    expect(mensagem(base({ repeticao: { modo: 'MENSAL' } }))).toBe('Informe a repetição: DIAS_DA_SEMANA ou A_CADA_N_DIAS.')
    expect(mensagem(base({ repeticao: undefined }))).toBe('Informe a repetição: DIAS_DA_SEMANA ou A_CADA_N_DIAS.')
  })

  it('exige pelo menos uma vez no dia, no máximo 12, sem repetidas e com hora HH:MM', () => {
    expect(mensagem(base({ vezes: [] }))).toBe('Informe pelo menos uma vez no dia.')
    expect(mensagem(base({ vezes: undefined }))).toBe('Informe pelo menos uma vez no dia.')
    expect(mensagem(base({ vezes: Array.from({ length: 13 }, (_, i) => ({ hora: `${String(i).padStart(2, '0')}:00` })) }))).toBe('No máximo 12 vezes por dia.')
    expect(mensagem(base({ vezes: [{ hora: '08:00' }, { hora: '08:00' }] }))).toBe('Há vezes repetidas no dia.')
    expect(mensagem(base({ vezes: [{}, { hora: null }] }))).toBe('Há vezes repetidas no dia.')
    expect(mensagem(base({ vezes: [{ hora: '24:00' }] }))).toBe('Hora inválida, use o formato HH:MM.')
    expect(mensagem(base({ vezes: [{ hora: '8:00' }] }))).toBe('Hora inválida, use o formato HH:MM.')
  })

  it('exige nome de 1 a 120 caracteres', () => {
    expect(mensagem(base({ nome: '  ' }))).toBe('Informe o nome do item.')
    expect(mensagem(base({ nome: undefined }))).toBe('Informe o nome do item.')
    expect(mensagem(base({ nome: 'a'.repeat(121) }))).toBe('O nome pode ter no máximo 120 caracteres.')
  })
})
