import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdicionarTarefaAoSprint } from '../../../../src/application/use-cases/sprints/AdicionarTarefaAoSprint'
import { ConcluirOcorrenciaRotina } from '../../../../src/application/use-cases/sprints/ConcluirOcorrenciaRotina'
import { ObterPlacarDoSprint } from '../../../../src/application/use-cases/sprints/ObterPlacarDoSprint'
import { ObterSprint } from '../../../../src/application/use-cases/sprints/ObterSprint'
import { ConcluirTarefa } from '../../../../src/application/use-cases/tarefas/ConcluirTarefa'
import type { OcorrenciaRotina } from '../../../../src/domain/entities/OcorrenciaRotina'
import type { FotoDoSprint } from '../../../../src/domain/entities/PlacarDoSprint'
import type { Sprint } from '../../../../src/domain/entities/Sprint'
import type { Tarefa } from '../../../../src/domain/entities/Tarefa'
import { ConflictError, ValidationError } from '../../../../src/domain/errors/DomainError'
import { MENSAGEM_SPRINT_FECHADO } from '../../../../src/domain/services/fechamentoDoSprint'
import {
  criarItemRotinaRepositoryFake,
  criarOcorrenciaRotinaRepositoryFake,
  criarSprintRepositoryFake,
  criarSuperTaskRepositoryFake,
  criarTarefaRepositoryFake,
} from '../../../helpers/repositoriosFake'

const USER = 'user-1'
// Sprint 16–20/11/2026. Instantes em UTC; São Paulo é UTC-3.
const SEXTA_2358 = new Date('2026-11-21T02:58:59Z')
const SEXTA_2359 = new Date('2026-11-21T02:59:00Z')
const SABADO_0000 = new Date('2026-11-21T03:00:00Z')

const FOTO: FotoDoSprint = {
  total: 300,
  feitos: 240,
  percentual: 80,
  bonus: false,
  rotina: { diasComRotina: 5, diasCumpridos: 5, pontosPorDia: 40, total: 200, feitos: 200 },
  tarefas: { quantidade: 5, concluidas: 2, total: 100, feitos: 40 },
  recompensa: null,
  detalhe: { tarefas: [], rotina: [] },
}

function sprint(sobrescritas: Partial<Sprint> = {}): Sprint {
  return {
    id: 'spr-1',
    inicio: '2026-11-16',
    fim: '2026-11-20',
    situacao: 'ABERTO',
    rotinaGeradaEm: '2026-11-16T10:00:00.000Z',
    criadoEm: '2026-01-01T00:00:00.000Z',
    recompensa: null,
    fechadoEm: null,
    foto: null,
    fechamentoAplicadoEm: null,
    ...sobrescritas,
  }
}

const TAREFA = {
  id: 'tar-1',
  areaId: 'area-1',
  titulo: 'Pintar',
  dia: '2026-11-20',
  hora: null,
  tempoEstimado: 60,
  dificuldade: 'FACIL',
  prioridade: 'BAIXA',
  notas: null,
  sprintId: null,
  superTaskId: null,
  concluidaEm: null,
  concluida: false,
  atrasada: false,
  naoConcluidaNoSprintDe: null,
  arquivada: false,
  arquivadaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
} satisfies Tarefa

describe('reserva do fechamento no acesso do usuário (ObterSprint)', () => {
  const sprints = criarSprintRepositoryFake()
  const ocorrencias = criarOcorrenciaRotinaRepositoryFake()
  const itens = criarItemRotinaRepositoryFake()

  beforeEach(() => {
    sprints.garantir.mockReset().mockImplementation(async () => sprint())
    ocorrencias.listarDoSprint.mockReset().mockResolvedValue([])
    itens.listar.mockReset().mockResolvedValue([])
  })

  it('fecha o sprint vencido ANTES de resolver o sprint atual/próximo', async () => {
    const fecharVencidos = { execute: vi.fn().mockResolvedValue(1) }
    const quarta = new Date('2026-11-25T15:00:00Z')

    await new ObterSprint(sprints, ocorrencias, itens, fecharVencidos).execute(USER, 'ATUAL', quarta)

    expect(fecharVencidos.execute).toHaveBeenCalledWith(USER, quarta)
    expect(fecharVencidos.execute.mock.invocationCallOrder[0]).toBeLessThan(sprints.garantir.mock.invocationCallOrder[0]!)
  })

  it('sem a reserva configurada, só resolve o sprint', async () => {
    await new ObterSprint(sprints, ocorrencias, itens).execute(USER, 'ATUAL', new Date('2026-11-18T15:00:00Z'))

    expect(sprints.garantir).toHaveBeenCalledTimes(1)
  })

  it('propaga falha da reserva sem devolver sprint', async () => {
    const erro = new Error('falha')
    const fecharVencidos = { execute: vi.fn().mockRejectedValue(erro) }

    await expect(
      new ObterSprint(sprints, ocorrencias, itens, fecharVencidos).execute(USER, 'ATUAL', new Date('2026-11-25T15:00:00Z')),
    ).rejects.toBe(erro)
    expect(sprints.garantir).not.toHaveBeenCalled()
  })
})

describe('placar de sprint fechado (imutável)', () => {
  const tarefas = { listar: vi.fn(), devolverNaoConcluidas: vi.fn() }

  it('devolve a foto gravada, sem recalcular nem ler as tarefas', async () => {
    const obterSprint = {
      execute: vi.fn().mockResolvedValue({
        sprint: sprint({ situacao: 'FECHADO', foto: FOTO, fechadoEm: '2026-11-21T02:59:00.000Z' }),
        iniciado: true,
        previa: false,
        ocorrencias: [],
        lembretes: [],
      }),
    }

    const resultado = await new ObterPlacarDoSprint(obterSprint, tarefas).execute(USER, 'ATUAL', SABADO_0000)

    expect(resultado).toMatchObject({ sprintId: 'spr-1', fechado: true, fechadoEm: '2026-11-21T02:59:00.000Z', placar: FOTO })
    expect(resultado.placar).toBe(FOTO)
    expect(tarefas.listar).not.toHaveBeenCalled()
  })

  it('sprint aberto segue ao vivo e informa `fechado: false`', async () => {
    tarefas.listar.mockResolvedValue([])
    const obterSprint = {
      execute: vi.fn().mockResolvedValue({ sprint: sprint(), iniciado: true, previa: false, ocorrencias: [], lembretes: [] }),
    }

    const resultado = await new ObterPlacarDoSprint(obterSprint, tarefas).execute(USER, 'ATUAL', SEXTA_2358)

    expect(resultado).toMatchObject({ fechado: false, fechadoEm: null })
    expect(tarefas.listar).toHaveBeenCalledWith(USER, 'spr-1', '2026-11-16', '2026-11-20')
  })
})

describe('sprint fechado não é reescrito por conclusões e travas (#69/#70)', () => {
  const OCORRENCIA: OcorrenciaRotina = {
    id: 'oco-1',
    sprintId: 'spr-1',
    itemId: 'rot-1',
    nome: 'Remédio',
    data: '2026-11-20',
    hora: null,
    indice: 0,
    ordem: 0,
    lembrete: false,
    concluidaEm: null,
  }

  function repositorioDeOcorrencias(ocorrencia: OcorrenciaRotina) {
    const repositorio = criarOcorrenciaRotinaRepositoryFake()
    repositorio.buscarPorId.mockResolvedValue(ocorrencia)
    repositorio.concluir.mockImplementation(async (_u: string, _id: string, quando: string) => ({ ...ocorrencia, concluidaEm: quando }))
    return repositorio
  }

  it('rotina de sexta: 23:58:59 SP ainda conclui; a partir de 23:59:00 SP o sprint fechou (409)', async () => {
    const repositorio = repositorioDeOcorrencias(OCORRENCIA)
    const caso = new ConcluirOcorrenciaRotina(repositorio)

    await expect(caso.execute(USER, 'oco-1', SEXTA_2358)).resolves.toMatchObject({ concluidaEm: SEXTA_2358.toISOString() })

    await expect(caso.execute(USER, 'oco-1', SEXTA_2359)).rejects.toThrow(MENSAGEM_SPRINT_FECHADO)
    await expect(caso.execute(USER, 'oco-1', SEXTA_2359)).rejects.toBeInstanceOf(ConflictError)
    expect(repositorio.concluir).toHaveBeenCalledTimes(1)
  })

  it('rotina de sexta concluída antes do fechamento continua idempotente depois dele', async () => {
    const concluida = { ...OCORRENCIA, concluidaEm: '2026-11-20T20:00:00.000Z' }
    const repositorio = repositorioDeOcorrencias(concluida)

    await expect(new ConcluirOcorrenciaRotina(repositorio).execute(USER, 'oco-1', SEXTA_2359)).resolves.toBe(concluida)
  })

  it('lembrete de sábado (fora do sprint, sem pontos) segue podendo ser concluído no próprio dia', async () => {
    const lembrete = { ...OCORRENCIA, data: '2026-11-21', lembrete: true }
    const repositorio = repositorioDeOcorrencias(lembrete)

    await new ConcluirOcorrenciaRotina(repositorio).execute(USER, 'oco-1', new Date('2026-11-21T15:00:00Z'))

    expect(repositorio.concluir).toHaveBeenCalled()
  })

  it('concluir tarefa fecha antes o sprint vencido: a conclusão tardia não entra na foto', async () => {
    const tarefas = criarTarefaRepositoryFake()
    const sprints = criarSprintRepositoryFake()
    const fecharVencidos = { execute: vi.fn().mockResolvedValue(1) }
    tarefas.buscarPorId.mockResolvedValue({ ...TAREFA, sprintId: null })
    tarefas.concluir.mockResolvedValue({ ...TAREFA, concluida: true })

    await new ConcluirTarefa(tarefas, sprints, criarSuperTaskRepositoryFake(), fecharVencidos).execute(USER, 'tar-1', SEXTA_2359)

    expect(fecharVencidos.execute).toHaveBeenCalledWith(USER, SEXTA_2359)
    expect(fecharVencidos.execute.mock.invocationCallOrder[0]).toBeLessThan(tarefas.buscarPorId.mock.invocationCallOrder[0]!)
  })

  it('sexta depois de 23:59 SP, concluir tarefa fora do sprint conclui sem entrar no sprint fechado', async () => {
    const tarefas = criarTarefaRepositoryFake()
    const sprints = criarSprintRepositoryFake()
    tarefas.buscarPorId.mockResolvedValue({ ...TAREFA })
    tarefas.concluir.mockResolvedValue({ ...TAREFA, concluida: true })

    await new ConcluirTarefa(tarefas, sprints, criarSuperTaskRepositoryFake()).execute(USER, 'tar-1', SEXTA_2359)

    expect(sprints.garantir).not.toHaveBeenCalled()
    expect(tarefas.definirSprint).not.toHaveBeenCalled()
    expect(tarefas.concluir).toHaveBeenCalled()
  })

  it('sexta às 23:58 SP ainda entra no sprint por conclusão', async () => {
    const tarefas = criarTarefaRepositoryFake()
    const sprints = criarSprintRepositoryFake()
    tarefas.buscarPorId.mockResolvedValue({ ...TAREFA })
    tarefas.concluir.mockResolvedValue({ ...TAREFA, concluida: true })
    tarefas.definirSprint.mockResolvedValue({ ...TAREFA, sprintId: 'spr-1' })
    sprints.garantir.mockResolvedValue(sprint())

    await new ConcluirTarefa(tarefas, sprints, criarSuperTaskRepositoryFake()).execute(USER, 'tar-1', SEXTA_2358)

    expect(tarefas.definirSprint).toHaveBeenCalledWith(USER, 'tar-1', { sprintId: 'spr-1', dia: '2026-11-20' })
  })

  it('adicionar ao sprint depois de sexta 23:59 SP é recusado (422), sem tocar no banco', async () => {
    const tarefas = criarTarefaRepositoryFake()
    const sprints = criarSprintRepositoryFake()
    tarefas.buscarPorId.mockResolvedValue({ ...TAREFA })

    const caso = new AdicionarTarefaAoSprint(tarefas, sprints)
    await expect(caso.execute(USER, 'tar-1', '2026-11-20', SEXTA_2359)).rejects.toBeInstanceOf(ValidationError)
    await expect(caso.execute(USER, 'tar-1', '2026-11-20', SEXTA_2359)).rejects.toThrow(MENSAGEM_SPRINT_FECHADO)
    expect(sprints.garantir).not.toHaveBeenCalled()
    expect(tarefas.definirSprint).not.toHaveBeenCalled()
  })
})
