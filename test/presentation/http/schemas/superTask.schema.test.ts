import { describe, expect, it } from 'vitest'

import {
  adicionarFilhaSchema,
  converterEmSuperTaskSchema,
  filhaParamsSchema,
  listarSuperTasksQuerySchema,
  moverSuperTaskSchema,
  removerSuperTaskQuerySchema,
  superTaskEdicaoSchema,
  superTaskPayloadSchema,
} from '../../../../src/presentation/http/schemas/superTask.schema'

const UUID = '123e4567-e89b-12d3-a456-426614174000'

function mensagem(resultado: { success: boolean; error?: { issues: { message: string }[] } }) {
  return resultado.error?.issues[0]?.message
}

describe('superTaskPayloadSchema', () => {
  it('aceita só título e área, preenchendo notas e Data de término com null', () => {
    expect(superTaskPayloadSchema.parse({ titulo: '  TCC  ', areaId: UUID })).toEqual({
      titulo: 'TCC',
      areaId: UUID,
      notas: null,
      dataTermino: null,
    })
  })

  it('aceita todos os campos e ignora tempo, dificuldade e prioridade (a Super task não tem)', () => {
    const resultado = superTaskPayloadSchema.parse({
      titulo: 'TCC',
      areaId: UUID,
      notas: 'n',
      dataTermino: '2026-12-20',
      tempoEstimado: 60,
      dificuldade: 'FACIL',
      prioridade: 'ALTA',
    })
    expect(resultado).toEqual({ titulo: 'TCC', areaId: UUID, notas: 'n', dataTermino: '2026-12-20' })
  })

  it.each([
    [{ areaId: UUID }, 'Informe o título da Super task.'],
    [{ titulo: '   ', areaId: UUID }, 'Informe o título da Super task.'],
    [{ titulo: 'x'.repeat(201), areaId: UUID }, 'O título pode ter no máximo 200 caracteres.'],
    [{ titulo: 'x' }, 'Área inválida.'],
    [{ titulo: 'x', areaId: 'abc' }, 'Área inválida.'],
    [{ titulo: 'x', areaId: UUID, notas: 'n'.repeat(2001) }, 'As notas podem ter no máximo 2000 caracteres.'],
    [{ titulo: 'x', areaId: UUID, dataTermino: '20/12/2026' }, 'Data de término inválida, use o formato YYYY-MM-DD.'],
    [{ titulo: 'x', areaId: UUID, dataTermino: '2026-13-45' }, 'Data de término inválida.'],
  ])('recusa %j', (entrada, esperada) => {
    expect(mensagem(superTaskPayloadSchema.safeParse(entrada))).toBe(esperada)
  })
})

describe('demais schemas', () => {
  it('edição substitui os campos (omitidos viram null) e não tem área', () => {
    expect(superTaskEdicaoSchema.parse({ titulo: 'TCC' })).toEqual({ titulo: 'TCC', notas: null, dataTermino: null })
  })

  it('mover exige uma área de destino válida', () => {
    expect(moverSuperTaskSchema.parse({ areaId: UUID })).toEqual({ areaId: UUID })
    expect(mensagem(moverSuperTaskSchema.safeParse({ areaId: 'x' }))).toBe('Área de destino inválida.')
  })

  it('converter aceita a tarefa e a Data de término opcional', () => {
    expect(converterEmSuperTaskSchema.parse({ tarefaId: UUID })).toEqual({ tarefaId: UUID, dataTermino: null })
    expect(converterEmSuperTaskSchema.parse({ tarefaId: UUID, dataTermino: '2026-12-20' }).dataTermino).toBe('2026-12-20')
    expect(mensagem(converterEmSuperTaskSchema.safeParse({}))).toBe('Tarefa inválida.')
  })

  it('adicionar filha e params da filha exigem uuid', () => {
    expect(adicionarFilhaSchema.parse({ tarefaId: UUID })).toEqual({ tarefaId: UUID })
    expect(mensagem(adicionarFilhaSchema.safeParse({ tarefaId: 'x' }))).toBe('Tarefa inválida.')
    expect(filhaParamsSchema.parse({ id: UUID, tarefaId: UUID })).toEqual({ id: UUID, tarefaId: UUID })
    expect(mensagem(filhaParamsSchema.safeParse({ id: 'x', tarefaId: UUID }))).toBe('Identificador inválido.')
    expect(mensagem(filhaParamsSchema.safeParse({ id: UUID, tarefaId: 'x' }))).toBe('Tarefa inválida.')
  })

  it('listagem: arquivadas ficam ocultas por padrão', () => {
    expect(listarSuperTasksQuerySchema.parse({})).toEqual({ arquivadas: false })
    expect(listarSuperTasksQuerySchema.parse({ areaId: UUID, arquivadas: 'true' })).toEqual({ areaId: UUID, arquivadas: true })
    expect(mensagem(listarSuperTasksQuerySchema.safeParse({ arquivadas: 'talvez' }))).toBe('Filtro de arquivadas inválido, use true ou false.')
    expect(mensagem(listarSuperTasksQuerySchema.safeParse({ areaId: 'x' }))).toBe('Área inválida.')
  })

  it('exclusão: sem parâmetro solta as filhas; excluir apaga junto', () => {
    expect(removerSuperTaskQuerySchema.parse({})).toEqual({ filhas: 'SOLTAR' })
    expect(removerSuperTaskQuerySchema.parse({ filhas: 'soltar' })).toEqual({ filhas: 'SOLTAR' })
    expect(removerSuperTaskQuerySchema.parse({ filhas: 'excluir' })).toEqual({ filhas: 'EXCLUIR' })
    expect(mensagem(removerSuperTaskQuerySchema.safeParse({ filhas: 'apagar' }))).toBe('Destino das filhas inválido, use soltar ou excluir.')
  })
})
