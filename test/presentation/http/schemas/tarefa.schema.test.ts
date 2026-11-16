import { describe, expect, it } from 'vitest'

import {
  listarTarefasQuerySchema,
  moverTarefaSchema,
  tarefaEdicaoSchema,
  tarefaPayloadSchema,
} from '../../../../src/presentation/http/schemas/tarefa.schema'

const UUID = '123e4567-e89b-12d3-a456-426614174000'

function mensagem(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues[0]?.message
}

describe('tarefaPayloadSchema', () => {
  it('aceita só título e área, preenchendo o resto com null', () => {
    expect(tarefaPayloadSchema.parse({ titulo: '  Pintar a casa  ', areaId: UUID })).toEqual({
      titulo: 'Pintar a casa',
      areaId: UUID,
      dia: null,
      hora: null,
      tempoEstimado: null,
      dificuldade: null,
      prioridade: null,
      notas: null,
    })
  })

  it('aceita todos os campos', () => {
    const completo = {
      titulo: 'Estudar',
      areaId: UUID,
      dia: '2026-12-01',
      hora: '08:30',
      tempoEstimado: 120,
      dificuldade: 'DIFICIL',
      prioridade: 'ALTA',
      notas: 'capítulo 3',
    }
    expect(tarefaPayloadSchema.parse(completo)).toEqual(completo)
  })

  it('trata null como ausente', () => {
    expect(tarefaPayloadSchema.parse({ titulo: 'x', areaId: UUID, dia: null, tempoEstimado: null }).dia).toBeNull()
  })

  it.each([
    [{ areaId: UUID }, 'Informe o título da tarefa.'],
    [{ titulo: '   ', areaId: UUID }, 'Informe o título da tarefa.'],
    [{ titulo: 'x'.repeat(201), areaId: UUID }, 'O título pode ter no máximo 200 caracteres.'],
    [{ titulo: 'x' }, 'Área inválida.'],
    [{ titulo: 'x', areaId: 'abc' }, 'Área inválida.'],
    [{ titulo: 'x', areaId: UUID, dia: '01/12/2026' }, 'Dia inválido, use o formato YYYY-MM-DD.'],
    [{ titulo: 'x', areaId: UUID, hora: '24:00' }, 'Hora inválida, use o formato HH:MM.'],
    [{ titulo: 'x', areaId: UUID, hora: '8:30' }, 'Hora inválida, use o formato HH:MM.'],
    [{ titulo: 'x', areaId: UUID, tempoEstimado: 45 }, 'Tempo estimado inválido: use 15, 30, 60, 120 ou 240 minutos.'],
    [{ titulo: 'x', areaId: UUID, dificuldade: 'MUITO' }, 'Dificuldade inválida.'],
    [{ titulo: 'x', areaId: UUID, prioridade: 'URGENTE' }, 'Prioridade inválida.'],
    [{ titulo: 'x', areaId: UUID, notas: 'n'.repeat(2001) }, 'As notas podem ter no máximo 2000 caracteres.'],
  ])('recusa %j', (entrada, esperada) => {
    const resultado = tarefaPayloadSchema.safeParse(entrada)
    expect(resultado.success).toBe(false)
    expect(mensagem(resultado)).toBe(esperada)
  })

  it.each([15, 30, 60, 120, 240])('aceita o tempo estimado de %i minutos', (tempoEstimado) => {
    expect(tarefaPayloadSchema.parse({ titulo: 'x', areaId: UUID, tempoEstimado }).tempoEstimado).toBe(tempoEstimado)
  })
})

describe('tarefaEdicaoSchema', () => {
  it('não carrega a área: ela só muda por mover', () => {
    expect(tarefaEdicaoSchema.parse({ titulo: 'x', areaId: UUID })).not.toHaveProperty('areaId')
  })

  it('limpa campos opcionais omitidos (substituição completa)', () => {
    expect(tarefaEdicaoSchema.parse({ titulo: 'x' })).toMatchObject({ dia: null, prioridade: null })
  })
})

describe('moverTarefaSchema', () => {
  it('aceita um uuid e recusa o resto', () => {
    expect(moverTarefaSchema.parse({ areaId: UUID })).toEqual({ areaId: UUID })
    expect(mensagem(moverTarefaSchema.safeParse({ areaId: 'x' }))).toBe('Área de destino inválida.')
    expect(moverTarefaSchema.safeParse({}).success).toBe(false)
  })
})

describe('listarTarefasQuerySchema', () => {
  it('oculta arquivadas por padrão', () => {
    expect(listarTarefasQuerySchema.parse({})).toEqual({ arquivadas: false })
  })

  it('lê areaId e arquivadas=true', () => {
    expect(listarTarefasQuerySchema.parse({ areaId: UUID, arquivadas: 'true' })).toEqual({ areaId: UUID, arquivadas: true })
    expect(listarTarefasQuerySchema.parse({ arquivadas: 'false' }).arquivadas).toBe(false)
  })

  it('recusa areaId e arquivadas inválidos', () => {
    expect(mensagem(listarTarefasQuerySchema.safeParse({ areaId: 'x' }))).toBe('Área inválida.')
    expect(mensagem(listarTarefasQuerySchema.safeParse({ arquivadas: 'sim' }))).toBe('Filtro de arquivadas inválido, use true ou false.')
  })
})
