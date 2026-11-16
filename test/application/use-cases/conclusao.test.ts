import { describe, expect, it } from 'vitest'

import { AdicionarTarefaAoSprint } from '../../../src/application/use-cases/sprints/AdicionarTarefaAoSprint'
import { ConcluirOcorrenciaRotina } from '../../../src/application/use-cases/sprints/ConcluirOcorrenciaRotina'
import { MoverTarefaNoSprint } from '../../../src/application/use-cases/sprints/MoverTarefaNoSprint'
import { RemoverTarefaDoSprint } from '../../../src/application/use-cases/sprints/RemoverTarefaDoSprint'
import { ArquivarTarefa } from '../../../src/application/use-cases/tarefas/ArquivarTarefa'
import { AtualizarTarefa } from '../../../src/application/use-cases/tarefas/AtualizarTarefa'
import { ConcluirTarefa } from '../../../src/application/use-cases/tarefas/ConcluirTarefa'
import { DesmarcarConclusaoTarefa } from '../../../src/application/use-cases/tarefas/DesmarcarConclusaoTarefa'
import { MoverTarefa } from '../../../src/application/use-cases/tarefas/MoverTarefa'
import { RemoverTarefa } from '../../../src/application/use-cases/tarefas/RemoverTarefa'
import type { OcorrenciaRotina } from '../../../src/domain/entities/OcorrenciaRotina'
import type { Tarefa } from '../../../src/domain/entities/Tarefa'
import { ConflictError, NotFoundError, ValidationError } from '../../../src/domain/errors/DomainError'
import { MENSAGEM_TAREFA_CONCLUIDA } from '../../../src/domain/services/sprintDaTarefa'
import {
  criarAreaRepositoryFake,
  criarOcorrenciaRotinaRepositoryFake,
  criarSprintRepositoryFake,
  criarSuperTaskRepositoryFake,
  criarTarefaRepositoryFake,
} from '../../helpers/repositoriosFake'

const USER_ID = 'user-1'
// Quarta 2026-11-18 12:00 em São Paulo. Sprint atual 16–20.
const QUARTA = new Date('2026-11-18T15:00:00.000Z')
const SABADO = new Date('2026-11-21T15:00:00.000Z')

const TAREFA: Tarefa = {
  id: 'tar-1',
  areaId: 'area-1',
  titulo: 'Pintar a casa',
  dia: null,
  hora: null,
  tempoEstimado: 60,
  dificuldade: 'MEDIA',
  prioridade: 'ALTA',
  notas: null,
  sprintId: null,
  superTaskId: null,
  concluidaEm: null,
  concluida: false,
  atrasada: false,
  arquivada: false,
  arquivadaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}
const CONCLUIDA: Tarefa = { ...TAREFA, dia: '2026-11-18', sprintId: 'spr-1', concluida: true, concluidaEm: '2026-11-18T14:00:00.000Z' }

function montarTarefa(tarefa: Tarefa | null) {
  const tarefas = criarTarefaRepositoryFake()
  const sprints = criarSprintRepositoryFake()
  tarefas.buscarPorId.mockResolvedValue(tarefa)
  tarefas.concluir.mockImplementation(async (_u: string, _id: string, quando: string) => ({
    ...(tarefa ?? TAREFA),
    concluida: true,
    concluidaEm: quando,
  }))
  tarefas.definirSprint.mockImplementation(async (_u: string, _id: string, v: { sprintId: string | null; dia?: string }) => ({
    ...(tarefa ?? TAREFA),
    sprintId: v.sprintId,
    dia: v.dia ?? (tarefa ?? TAREFA).dia,
  }))
  sprints.garantir.mockResolvedValue({ id: 'spr-1', inicio: '2026-11-16', fim: '2026-11-20' })
  return { tarefas, sprints }
}

describe('ConcluirTarefa', () => {
  it('grava a conclusão com o instante atual em ISO', async () => {
    const { tarefas, sprints } = montarTarefa({ ...TAREFA, dia: '2026-11-18', sprintId: 'spr-1' })

    const resultado = await new ConcluirTarefa(tarefas, sprints, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', QUARTA)

    expect(tarefas.concluir).toHaveBeenCalledWith(USER_ID, 'tar-1', '2026-11-18T15:00:00.000Z')
    expect(resultado.concluida).toBe(true)
    expect(tarefas.definirSprint).not.toHaveBeenCalled()
  })

  it('concluir num dia útil uma tarefa fora do sprint a puxa para o sprint atual, com dia = hoje, antes de gravar', async () => {
    const { tarefas, sprints } = montarTarefa({ ...TAREFA, dia: '2026-11-10' })

    await new ConcluirTarefa(tarefas, sprints, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', QUARTA)

    expect(sprints.garantir).toHaveBeenCalledWith(USER_ID, '2026-11-16', '2026-11-20')
    expect(tarefas.definirSprint).toHaveBeenCalledWith(USER_ID, 'tar-1', { sprintId: 'spr-1', dia: '2026-11-18' })
    expect(tarefas.definirSprint.mock.invocationCallOrder[0]).toBeLessThan(tarefas.concluir.mock.invocationCallOrder[0]!)
  })

  it('no fim de semana conclui sem entrar no sprint', async () => {
    const { tarefas, sprints } = montarTarefa({ ...TAREFA })

    await new ConcluirTarefa(tarefas, sprints, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', SABADO)

    expect(tarefas.definirSprint).not.toHaveBeenCalled()
    expect(tarefas.concluir).toHaveBeenCalled()
  })

  it('sem pontuação completa conclui sem entrar no sprint', async () => {
    const { tarefas, sprints } = montarTarefa({ ...TAREFA, tempoEstimado: null })

    await new ConcluirTarefa(tarefas, sprints, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', QUARTA)

    expect(tarefas.definirSprint).not.toHaveBeenCalled()
    expect(tarefas.concluir).toHaveBeenCalled()
  })

  it('dia que já passou, dentro do sprint, pode ser concluído (a trava só permite concluir)', async () => {
    const { tarefas, sprints } = montarTarefa({ ...TAREFA, dia: '2026-11-16', sprintId: 'spr-1' })

    await new ConcluirTarefa(tarefas, sprints, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', QUARTA)
    expect(tarefas.concluir).toHaveBeenCalled()
  })

  it('já concluída: devolve a tarefa sem mudar o instante', async () => {
    const { tarefas, sprints } = montarTarefa(CONCLUIDA)

    await expect(new ConcluirTarefa(tarefas, sprints, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', QUARTA)).resolves.toBe(CONCLUIDA)
    expect(tarefas.concluir).not.toHaveBeenCalled()
  })

  it('recusa tarefa arquivada e tarefa inexistente', async () => {
    const arquivada = montarTarefa({ ...TAREFA, arquivada: true })
    await expect(new ConcluirTarefa(arquivada.tarefas, arquivada.sprints, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', QUARTA)).rejects.toBeInstanceOf(ValidationError)

    const inexistente = montarTarefa(null)
    await expect(new ConcluirTarefa(inexistente.tarefas, inexistente.sprints, criarSuperTaskRepositoryFake()).execute(USER_ID, 'x', QUARTA)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('DesmarcarConclusaoTarefa', () => {
  it('desmarcar uma tarefa concluída é recusado (409) com a mensagem de conclusão definitiva', async () => {
    const { tarefas } = montarTarefa(CONCLUIDA)

    await expect(new DesmarcarConclusaoTarefa(tarefas).execute(USER_ID, 'tar-1')).rejects.toThrow(MENSAGEM_TAREFA_CONCLUIDA)
    await expect(new DesmarcarConclusaoTarefa(tarefas).execute(USER_ID, 'tar-1')).rejects.toBeInstanceOf(ConflictError)
  })

  it('tarefa não concluída: também recusa, dizendo que não está concluída', async () => {
    const { tarefas } = montarTarefa(TAREFA)
    await expect(new DesmarcarConclusaoTarefa(tarefas).execute(USER_ID, 'tar-1')).rejects.toThrow('não está concluída')
  })

  it('tarefa inexistente: NotFoundError', async () => {
    const { tarefas } = montarTarefa(null)
    await expect(new DesmarcarConclusaoTarefa(tarefas).execute(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('tarefa concluída é imutável', () => {
  const edicao = { titulo: 'x', dia: '2026-11-19', hora: null, tempoEstimado: 60, dificuldade: 'MEDIA', prioridade: 'ALTA', notas: null } as const
  const casos: [string, (t: ReturnType<typeof montarTarefa>) => Promise<unknown>][] = [
    ['editar', ({ tarefas, sprints }) => new AtualizarTarefa(tarefas, sprints).execute(USER_ID, 'tar-1', edicao, QUARTA)],
    ['mudar de área', ({ tarefas }) => new MoverTarefa(tarefas, criarAreaRepositoryFake()).execute(USER_ID, 'tar-1', 'area-2', QUARTA)],
    ['excluir', ({ tarefas }) => new RemoverTarefa(tarefas, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', QUARTA)],
    ['arquivar', ({ tarefas }) => new ArquivarTarefa(tarefas).execute(USER_ID, 'tar-1', QUARTA)],
    ['tirar do sprint', ({ tarefas }) => new RemoverTarefaDoSprint(tarefas).execute(USER_ID, 'tar-1', QUARTA)],
    ['mudar o dia no sprint', ({ tarefas, sprints }) => new MoverTarefaNoSprint(tarefas, sprints).execute(USER_ID, 'tar-1', '2026-11-19', QUARTA)],
    ['adicionar ao sprint', ({ tarefas, sprints }) => new AdicionarTarefaAoSprint(tarefas, sprints).execute(USER_ID, 'tar-1', '2026-11-19', QUARTA)],
  ]

  it.each(casos)('%s é recusado com ConflictError e não grava nada', async (_nome, acao) => {
    const montado = montarTarefa(CONCLUIDA)

    await expect(acao(montado)).rejects.toThrow(MENSAGEM_TAREFA_CONCLUIDA)
    await expect(acao(montado)).rejects.toBeInstanceOf(ConflictError)
    expect(montado.tarefas.atualizar).not.toHaveBeenCalled()
    expect(montado.tarefas.remover).not.toHaveBeenCalled()
    expect(montado.tarefas.mover).not.toHaveBeenCalled()
    expect(montado.tarefas.definirSprint).not.toHaveBeenCalled()
    expect(montado.tarefas.definirArquivamento).not.toHaveBeenCalled()
  })

  it('a conclusão vale antes da trava de dia passado', async () => {
    const montado = montarTarefa({ ...CONCLUIDA, dia: '2026-11-16' })
    await expect(new RemoverTarefaDoSprint(montado.tarefas).execute(USER_ID, 'tar-1', QUARTA)).rejects.toThrow(MENSAGEM_TAREFA_CONCLUIDA)
  })
})

describe('ConcluirOcorrenciaRotina', () => {
  const OCORRENCIA: OcorrenciaRotina = {
    id: 'oco-1',
    sprintId: 'spr-1',
    itemId: 'rot-1',
    nome: 'Tomar remédio',
    data: '2026-11-18',
    hora: '08:00',
    indice: 0,
    ordem: 0,
    lembrete: false,
    concluidaEm: null,
  }

  function montar(ocorrencia: OcorrenciaRotina | null) {
    const repositorio = criarOcorrenciaRotinaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(ocorrencia)
    repositorio.concluir.mockImplementation(async (_u: string, _id: string, quando: string) => ({ ...OCORRENCIA, concluidaEm: quando }))
    return repositorio
  }

  it('conclui no próprio dia, em qualquer horário (a hora da rotina nunca gera atraso)', async () => {
    const repositorio = montar(OCORRENCIA)
    // Rotina das 08:00 concluída às 23:59 (SP) do mesmo dia: continua válida.
    const noite = new Date('2026-11-19T02:59:00.000Z')

    const resultado = await new ConcluirOcorrenciaRotina(repositorio).execute(USER_ID, 'oco-1', noite)

    expect(repositorio.concluir).toHaveBeenCalledWith(USER_ID, 'oco-1', '2026-11-19T02:59:00.000Z')
    expect(resultado.concluidaEm).toBe('2026-11-19T02:59:00.000Z')
  })

  it('antes do dia: recusa', async () => {
    const repositorio = montar({ ...OCORRENCIA, data: '2026-11-19' })
    await expect(new ConcluirOcorrenciaRotina(repositorio).execute(USER_ID, 'oco-1', QUARTA)).rejects.toThrow('outro dia')
    expect(repositorio.concluir).not.toHaveBeenCalled()
  })

  it('depois do dia: recusa', async () => {
    const repositorio = montar({ ...OCORRENCIA, data: '2026-11-17' })
    await expect(new ConcluirOcorrenciaRotina(repositorio).execute(USER_ID, 'oco-1', QUARTA)).rejects.toBeInstanceOf(ValidationError)
    await expect(new ConcluirOcorrenciaRotina(repositorio).execute(USER_ID, 'oco-1', QUARTA)).rejects.toThrow('já passou')
    expect(repositorio.concluir).not.toHaveBeenCalled()
  })

  it('virada de dia em São Paulo: 23:59 ainda é o dia; 00:00 já é o dia seguinte e recusa', async () => {
    const repositorio = montar(OCORRENCIA)
    await expect(new ConcluirOcorrenciaRotina(repositorio).execute(USER_ID, 'oco-1', new Date('2026-11-19T02:59:00.000Z'))).resolves.toBeDefined()
    await expect(new ConcluirOcorrenciaRotina(repositorio).execute(USER_ID, 'oco-1', new Date('2026-11-19T03:00:00.000Z'))).rejects.toBeInstanceOf(ValidationError)
  })

  it('fuso: 00:30 UTC do dia 18 ainda é dia 17 em SP, então a rotina do dia 18 é de "outro dia"', async () => {
    const repositorio = montar(OCORRENCIA)
    await expect(new ConcluirOcorrenciaRotina(repositorio).execute(USER_ID, 'oco-1', new Date('2026-11-18T00:30:00.000Z'))).rejects.toThrow('outro dia')
  })

  it('já concluída: idempotente, sem mudar o instante', async () => {
    const ja = { ...OCORRENCIA, concluidaEm: '2026-11-18T13:00:00.000Z' }
    const repositorio = montar(ja)
    await expect(new ConcluirOcorrenciaRotina(repositorio).execute(USER_ID, 'oco-1', QUARTA)).resolves.toBe(ja)
    expect(repositorio.concluir).not.toHaveBeenCalled()
  })

  it('ocorrência inexistente: NotFoundError', async () => {
    const repositorio = montar(null)
    await expect(new ConcluirOcorrenciaRotina(repositorio).execute(USER_ID, 'x', QUARTA)).rejects.toBeInstanceOf(NotFoundError)
  })
})
