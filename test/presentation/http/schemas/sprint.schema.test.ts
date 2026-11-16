import { describe, expect, it } from 'vitest'

import { adicionarTarefaAoSprintSchema, moverTarefaNoSprintSchema } from '../../../../src/presentation/http/schemas/sprint.schema'

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
