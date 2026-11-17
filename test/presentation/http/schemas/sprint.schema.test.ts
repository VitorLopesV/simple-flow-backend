import { describe, expect, it } from 'vitest'

import {
  adicionarTarefaAoSprintSchema,
  historicoQuerySchema,
  moverTarefaNoSprintSchema,
  recompensaDoSprintSchema,
  recompensaPadraoSchema,
} from '../../../../src/presentation/http/schemas/sprint.schema'

const UUID = '123e4567-e89b-12d3-a456-426614174000'

function mensagem(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues[0]?.message
}

describe('adicionarTarefaAoSprintSchema', () => {
  it('aceita a tarefa com ou sem dia', () => {
    expect(adicionarTarefaAoSprintSchema.parse({ tarefaId: UUID })).toEqual({ tarefaId: UUID })
    expect(adicionarTarefaAoSprintSchema.parse({ tarefaId: UUID, dia: '2026-11-18' })).toEqual({ tarefaId: UUID, dia: '2026-11-18' })
  })

  it('recusa tarefa e dia inválidos com mensagem clara', () => {
    expect(mensagem(adicionarTarefaAoSprintSchema.safeParse({}))).toBe('Tarefa inválida.')
    expect(mensagem(adicionarTarefaAoSprintSchema.safeParse({ tarefaId: 'x' }))).toBe('Tarefa inválida.')
    expect(mensagem(adicionarTarefaAoSprintSchema.safeParse({ tarefaId: UUID, dia: '18/11' }))).toBe('Dia inválido, use o formato YYYY-MM-DD.')
  })
})

describe('moverTarefaNoSprintSchema', () => {
  it('exige o dia no formato YYYY-MM-DD', () => {
    expect(moverTarefaNoSprintSchema.parse({ dia: '2026-11-19' })).toEqual({ dia: '2026-11-19' })
    expect(mensagem(moverTarefaNoSprintSchema.safeParse({}))).toBe('Dia inválido, use o formato YYYY-MM-DD.')
    expect(mensagem(moverTarefaNoSprintSchema.safeParse({ dia: '2026-1-9' }))).toBe('Dia inválido, use o formato YYYY-MM-DD.')
  })
})

describe('recompensaDoSprintSchema / recompensaPadraoSchema', () => {
  it('apara o texto e troca vazio por null (limpa a recompensa)', () => {
    expect(recompensaDoSprintSchema.parse({ recompensa: '  Pedir pizza ' })).toEqual({ recompensa: 'Pedir pizza' })
    expect(recompensaDoSprintSchema.parse({ recompensa: '   ' })).toEqual({ recompensa: null })
    expect(recompensaDoSprintSchema.parse({ recompensa: null })).toEqual({ recompensa: null })
    expect(recompensaPadraoSchema.parse({ recompensaPadrao: 'Cinema' })).toEqual({ recompensaPadrao: 'Cinema' })
  })

  it('aceita 120 caracteres e recusa 121, tipo errado ou campo ausente', () => {
    expect(recompensaDoSprintSchema.safeParse({ recompensa: 'x'.repeat(120) }).success).toBe(true)
    expect(mensagem(recompensaDoSprintSchema.safeParse({ recompensa: 'x'.repeat(121) }))).toContain('até 120')
    expect(mensagem(recompensaDoSprintSchema.safeParse({ recompensa: 'x'.repeat(500) }))).toContain('até 120')
    expect(mensagem(recompensaDoSprintSchema.safeParse({ recompensa: 3 }))).toContain('até 120')
    expect(mensagem(recompensaDoSprintSchema.safeParse({}))).toContain('até 120')
  })
})

describe('historicoQuerySchema', () => {
  it('usa página 1 e 10 por página por padrão e converte números de query', () => {
    expect(historicoQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 })
    expect(historicoQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 })
  })

  it('limita o tamanho da página a 50 e recusa valores inválidos', () => {
    expect(mensagem(historicoQuerySchema.safeParse({ pageSize: '51' }))).toBe('Tamanho de página inválido: no máximo 50.')
    expect(mensagem(historicoQuerySchema.safeParse({ pageSize: '0' }))).toBe('Tamanho de página inválido.')
    expect(mensagem(historicoQuerySchema.safeParse({ pageSize: 'abc' }))).toBe('Tamanho de página inválido.')
    expect(mensagem(historicoQuerySchema.safeParse({ page: '0' }))).toBe('Página inválida.')
    expect(mensagem(historicoQuerySchema.safeParse({ page: '1.5' }))).toBe('Página inválida.')
  })
})
