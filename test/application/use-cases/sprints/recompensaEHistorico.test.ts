import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DefinirRecompensaDoSprint, MENSAGEM_RECOMPENSA_DE_SPRINT_FECHADO } from '../../../../src/application/use-cases/sprints/DefinirRecompensaDoSprint'
import { FecharSprintsVencidos } from '../../../../src/application/use-cases/sprints/FecharSprintsVencidos'
import { ListarHistoricoDeSprints } from '../../../../src/application/use-cases/sprints/ListarHistoricoDeSprints'
import { ObterPlacarDoSprint } from '../../../../src/application/use-cases/sprints/ObterPlacarDoSprint'
import { ObterSprint } from '../../../../src/application/use-cases/sprints/ObterSprint'
import { DefinirRecompensaPadrao, ObterRecompensaPadrao } from '../../../../src/application/use-cases/sprints/RecompensaPadrao'
import type { FotoDoSprint, TarefaDoSprint } from '../../../../src/domain/entities/PlacarDoSprint'
import type { Sprint } from '../../../../src/domain/entities/Sprint'
import { ConflictError } from '../../../../src/domain/errors/DomainError'
import {
  criarItemRotinaRepositoryFake,
  criarOcorrenciaRotinaRepositoryFake,
  criarRecompensaPadraoRepositoryFake,
  criarSprintRepositoryFake,
} from '../../../helpers/repositoriosFake'

const USER = 'u1'
const SEXTA_2359 = new Date('2026-11-21T02:59:00Z')

function sprint(extra: Partial<Sprint> = {}): Sprint {
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
    ...extra,
  }
}

function tarefa(id: string, concluida: boolean, atrasada = false): TarefaDoSprint {
  return { id, titulo: `T ${id}`, dia: '2026-11-18', hora: null, tempoEstimado: 60, dificuldade: 'DIFICIL', prioridade: 'ALTA', concluida, atrasada, superTask: false }
}

describe('recompensa padrão', () => {
  const repo = criarRecompensaPadraoRepositoryFake()

  it('lê e grava (inclusive limpar com null)', async () => {
    repo.obter.mockResolvedValue('Cinema')
    repo.definir.mockResolvedValue(null)

    expect(await new ObterRecompensaPadrao(repo).execute(USER)).toEqual({ recompensaPadrao: 'Cinema' })
    expect(await new DefinirRecompensaPadrao(repo).execute(USER, null)).toEqual({ recompensaPadrao: null })
    expect(repo.definir).toHaveBeenCalledWith(USER, null)
  })
})

describe('DefinirRecompensaDoSprint', () => {
  const sprints = criarSprintRepositoryFake()
  const padrao = criarRecompensaPadraoRepositoryFake()
  const obterSprint = { execute: vi.fn() }
  const caso = new DefinirRecompensaDoSprint(obterSprint, sprints, padrao)

  beforeEach(() => {
    vi.resetAllMocks()
    padrao.obter.mockResolvedValue('Cinema')
    sprints.definirRecompensa.mockResolvedValue(true)
  })

  it('define a recompensa do próximo sprint durante o planejamento e devolve a efetiva', async () => {
    obterSprint.execute.mockResolvedValue({ sprint: sprint({ id: 'spr-2', inicio: '2026-11-23', fim: '2026-11-27' }) })

    const resultado = await caso.execute(USER, 'PROXIMO', 'Pizza')

    expect(obterSprint.execute).toHaveBeenCalledWith(USER, 'PROXIMO', expect.any(Date))
    expect(sprints.definirRecompensa).toHaveBeenCalledWith(USER, 'spr-2', 'Pizza')
    expect(resultado).toEqual({
      sprintId: 'spr-2',
      inicio: '2026-11-23',
      fim: '2026-11-27',
      recompensa: 'Pizza',
      recompensaPadrao: 'Cinema',
      recompensaEfetiva: 'Pizza',
    })
  })

  it('limpar (null) faz o sprint voltar a usar a padrão', async () => {
    obterSprint.execute.mockResolvedValue({ sprint: sprint() })

    const resultado = await caso.execute(USER, 'PROXIMO', null)

    expect(resultado).toMatchObject({ recompensa: null, recompensaEfetiva: 'Cinema' })
  })

  it('sprint já fechado é imutável: 409 sem gravar', async () => {
    obterSprint.execute.mockResolvedValue({ sprint: sprint({ situacao: 'FECHADO' }) })

    await expect(caso.execute(USER, 'ATUAL', 'Pizza')).rejects.toThrow(MENSAGEM_RECOMPENSA_DE_SPRINT_FECHADO)
    await expect(caso.execute(USER, 'ATUAL', 'Pizza')).rejects.toBeInstanceOf(ConflictError)
    expect(sprints.definirRecompensa).not.toHaveBeenCalled()
  })

  it('fechou entre a leitura e a escrita: o repositório recusa e vira 409', async () => {
    obterSprint.execute.mockResolvedValue({ sprint: sprint() })
    sprints.definirRecompensa.mockResolvedValue(false)

    await expect(caso.execute(USER, 'ATUAL', 'Pizza')).rejects.toBeInstanceOf(ConflictError)
  })
})

describe('ObterSprint / ObterPlacarDoSprint: recompensa efetiva', () => {
  const sprints = criarSprintRepositoryFake()
  const ocorrencias = criarOcorrenciaRotinaRepositoryFake()
  const itens = criarItemRotinaRepositoryFake()
  const padrao = criarRecompensaPadraoRepositoryFake()

  beforeEach(() => {
    vi.resetAllMocks()
    ocorrencias.listarDoSprint.mockResolvedValue([])
    padrao.obter.mockResolvedValue('Cinema')
    itens.listar.mockResolvedValue([])
  })

  it('sprint sem recompensa usa a padrão; com recompensa própria usa a dele', async () => {
    const hoje = new Date('2026-11-18T15:00:00Z')
    sprints.garantir.mockResolvedValue(sprint())
    const obter = new ObterSprint(sprints, ocorrencias, itens, undefined, padrao)
    expect(await obter.execute(USER, 'ATUAL', hoje)).toMatchObject({ recompensaPadrao: 'Cinema', recompensaEfetiva: 'Cinema' })

    sprints.garantir.mockResolvedValue(sprint({ recompensa: 'Pizza' }))
    expect(await obter.execute(USER, 'ATUAL', hoje)).toMatchObject({ recompensaPadrao: 'Cinema', recompensaEfetiva: 'Pizza' })
  })

  it('prévia do próximo sprint (rotina ainda não gerada) também traz a recompensa', async () => {
    sprints.garantir.mockResolvedValue(sprint({ id: 'spr-2', inicio: '2026-11-23', fim: '2026-11-27', rotinaGeradaEm: null }))
    const obter = new ObterSprint(sprints, ocorrencias, itens, undefined, padrao)

    expect(await obter.execute(USER, 'PROXIMO', new Date('2026-11-18T15:00:00Z'))).toMatchObject({ previa: true, recompensaEfetiva: 'Cinema' })
  })

  it('sem repositório da padrão, ela vem nula', async () => {
    sprints.garantir.mockResolvedValue(sprint())
    const obter = new ObterSprint(sprints, ocorrencias, itens)

    expect(await obter.execute(USER, 'ATUAL', new Date('2026-11-18T15:00:00Z'))).toMatchObject({ recompensaPadrao: null, recompensaEfetiva: null })
  })

  it('sprint fechado mostra a recompensa gravada na foto, não a padrão de agora', async () => {
    const foto = { total: 10, feitos: 10, percentual: 100, bonus: true, rotina: {}, tarefas: {}, recompensa: 'Pizza', detalhe: { tarefas: [], rotina: [] } } as unknown as FotoDoSprint
    sprints.garantir.mockResolvedValue(sprint({ situacao: 'FECHADO', foto, fechadoEm: '2026-11-21T02:59:00.000Z' }))
    const obter = new ObterSprint(sprints, ocorrencias, itens, undefined, padrao)

    expect(await obter.execute(USER, 'ATUAL', new Date('2026-11-22T15:00:00Z'))).toMatchObject({ recompensaEfetiva: 'Pizza' })
    const placar = await new ObterPlacarDoSprint(obter, { listar: vi.fn(), devolverNaoConcluidas: vi.fn() }).execute(USER, 'ATUAL', new Date('2026-11-22T15:00:00Z'))
    expect(placar).toMatchObject({ fechado: true, recompensa: 'Pizza' })
  })

  it('placar ao vivo traz a recompensa efetiva', async () => {
    sprints.garantir.mockResolvedValue(sprint({ recompensa: 'Pizza' }))
    const tarefas = { listar: vi.fn().mockResolvedValue([]), devolverNaoConcluidas: vi.fn() }
    const obter = new ObterSprint(sprints, ocorrencias, itens, undefined, padrao)

    const placar = await new ObterPlacarDoSprint(obter, tarefas).execute(USER, 'ATUAL', new Date('2026-11-18T15:00:00Z'))

    expect(placar).toMatchObject({ fechado: false, recompensa: 'Pizza' })
  })
})

describe('fechamento grava a recompensa efetiva na foto', () => {
  const sprints = criarSprintRepositoryFake()
  const ocorrencias = criarOcorrenciaRotinaRepositoryFake()
  const tarefas = { listar: vi.fn(), devolverNaoConcluidas: vi.fn() }
  const padrao = criarRecompensaPadraoRepositoryFake()
  const caso = new FecharSprintsVencidos(sprints, ocorrencias as never, tarefas, padrao)

  beforeEach(() => {
    vi.resetAllMocks()
    sprints.fechar.mockResolvedValue(true)
    sprints.garantir.mockResolvedValue(sprint({ id: 'spr-2' }))
    sprints.marcarFechamentoAplicado.mockResolvedValue(undefined)
    ocorrencias.listarDoSprint.mockResolvedValue([])
    tarefas.listar.mockResolvedValue([tarefa('a', true), tarefa('b', false)])
    tarefas.devolverNaoConcluidas.mockResolvedValue(undefined)
  })

  it('sem recompensa no sprint, grava a padrão vigente no fechamento', async () => {
    sprints.listarPendentesDeFechamento.mockResolvedValue([sprint()])
    padrao.obter.mockResolvedValue('Cinema')

    await caso.execute(USER, SEXTA_2359)

    expect(sprints.fechar.mock.calls[0]![2]).toMatchObject({ recompensa: 'Cinema' })
  })

  it('com recompensa própria, grava a do sprint (a padrão é ignorada)', async () => {
    sprints.listarPendentesDeFechamento.mockResolvedValue([sprint({ recompensa: 'Pizza' })])
    padrao.obter.mockResolvedValue('Cinema')

    await caso.execute(USER, SEXTA_2359)

    expect(sprints.fechar.mock.calls[0]![2]).toMatchObject({ recompensa: 'Pizza' })
  })

  it('sem nenhuma das duas, grava recompensa nula', async () => {
    sprints.listarPendentesDeFechamento.mockResolvedValue([sprint()])
    padrao.obter.mockResolvedValue(null)

    await caso.execute(USER, SEXTA_2359)

    expect(sprints.fechar.mock.calls[0]![2]).toMatchObject({ recompensa: null })
  })

  it('a foto leva o detalhe das tarefas ANTES de as não concluídas saírem do sprint', async () => {
    sprints.listarPendentesDeFechamento.mockResolvedValue([sprint()])
    padrao.obter.mockResolvedValue(null)

    await caso.execute(USER, SEXTA_2359)

    const foto = sprints.fechar.mock.calls[0]![2] as FotoDoSprint
    expect(foto.detalhe.tarefas.map((t) => [t.id, t.situacao])).toEqual([
      ['a', 'CONCLUIDA'],
      ['b', 'NAO_CONCLUIDA'],
    ])
    expect(sprints.fechar.mock.invocationCallOrder[0]).toBeLessThan(tarefas.devolverNaoConcluidas.mock.invocationCallOrder[0]!)
  })
})

describe('ListarHistoricoDeSprints', () => {
  const sprints = criarSprintRepositoryFake()
  const caso = new ListarHistoricoDeSprints(sprints)

  function foto(extra: Partial<FotoDoSprint> = {}): FotoDoSprint {
    return {
      total: 100,
      feitos: 95,
      percentual: 95,
      bonus: true,
      rotina: { diasComRotina: 1, diasCumpridos: 1, pontosPorDia: 40, total: 40, feitos: 40 },
      tarefas: { quantidade: 3, concluidas: 2, total: 60, feitos: 55 },
      recompensa: 'Pizza',
      detalhe: {
        tarefas: [
          { id: 'a', titulo: 'A', dia: '2026-11-17', hora: null, tempoEstimado: 60, dificuldade: 'DIFICIL', prioridade: 'ALTA', pontos: 15, pontosGanhos: 15, situacao: 'CONCLUIDA' },
          { id: 'b', titulo: 'B', dia: '2026-11-17', hora: null, tempoEstimado: 60, dificuldade: 'DIFICIL', prioridade: 'ALTA', pontos: 15, pontosGanhos: 3, situacao: 'ATRASADA' },
          { id: 'c', titulo: 'C', dia: '2026-11-18', hora: null, tempoEstimado: 60, dificuldade: 'DIFICIL', prioridade: 'ALTA', pontos: 15, pontosGanhos: 0, situacao: 'NAO_CONCLUIDA' },
        ],
        rotina: [{ data: '2026-11-16', cumprido: true, itens: [{ nome: 'Remédio', hora: '08:00', concluida: true }] }],
      },
      ...extra,
    }
  }

  beforeEach(() => vi.resetAllMocks())

  it('lista paginado, com foto, recompensa conquistada, tarefas e rotina por dia', async () => {
    sprints.listarFechados.mockResolvedValue({
      sprints: [sprint({ id: 'novo', situacao: 'FECHADO', fechadoEm: '2026-11-21T02:59:00.000Z', foto: foto() }), sprint({ id: 'velho', inicio: '2026-11-09', fim: '2026-11-13', situacao: 'FECHADO', foto: foto({ bonus: false, percentual: 60 }) })],
      total: 12,
    })

    const pagina = await caso.execute(USER, 2, 2)

    expect(sprints.listarFechados).toHaveBeenCalledWith(USER, 2, 2)
    expect(pagina).toMatchObject({ page: 2, pageSize: 2, total: 12, totalPages: 6 })
    expect(pagina.items[0]).toMatchObject({
      sprintId: 'novo',
      total: 100,
      feitos: 95,
      percentual: 95,
      bonus: true,
      recompensa: 'Pizza',
      recompensaConquistada: true,
      tarefas: { quantidade: 3, concluidas: 2, atrasadas: 1, naoConcluidas: 1 },
      rotina: { diasCumpridos: 1, dias: [{ data: '2026-11-16', cumprido: true }] },
    })
    expect(pagina.items[0]!.tarefas.itens).toHaveLength(3)
    expect(pagina.items[1]).toMatchObject({ bonus: false, recompensaConquistada: false })
  })

  it('bônus sem recompensa em jogo não é recompensa conquistada', async () => {
    sprints.listarFechados.mockResolvedValue({ sprints: [sprint({ situacao: 'FECHADO', foto: foto({ recompensa: null }) })], total: 1 })

    expect((await caso.execute(USER, 1, 10)).items[0]).toMatchObject({ recompensa: null, recompensaConquistada: false })
  })

  it('estado vazio: nenhum sprint fechado', async () => {
    sprints.listarFechados.mockResolvedValue({ sprints: [], total: 0 })

    expect(await caso.execute(USER, 1, 10)).toEqual({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 })
  })

  it('foto antiga, sem detalhe nem recompensa, vira lista vazia em vez de quebrar', async () => {
    const antiga = { total: 0, feitos: 0, percentual: 0, bonus: false, rotina: { diasComRotina: 0, diasCumpridos: 0, pontosPorDia: 40, total: 0, feitos: 0 }, tarefas: { quantidade: 0, concluidas: 0, total: 0, feitos: 0 } } as unknown as FotoDoSprint
    sprints.listarFechados.mockResolvedValue({ sprints: [sprint({ situacao: 'FECHADO', foto: antiga }), sprint({ id: 'sem-foto', situacao: 'FECHADO', foto: null })], total: 2 })

    const { items } = await caso.execute(USER, 1, 10)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ recompensa: null, tarefas: { itens: [], atrasadas: 0, naoConcluidas: 0 }, rotina: { dias: [] } })
  })

  it('o detalhe vem só da foto: segue completo depois de as tarefas serem excluídas ou arquivadas', async () => {
    // Fecha o sprint com 2 tarefas e guarda a foto que o repositório gravou.
    const tarefasRepo = { listar: vi.fn().mockResolvedValue([tarefa('a', true), tarefa('b', false)]), devolverNaoConcluidas: vi.fn() }
    const padrao = criarRecompensaPadraoRepositoryFake()
    padrao.obter.mockResolvedValue('Pizza')
    const ocorrenciasRepo = criarOcorrenciaRotinaRepositoryFake()
    ocorrenciasRepo.listarDoSprint.mockResolvedValue([])
    sprints.listarPendentesDeFechamento.mockResolvedValue([sprint()])
    sprints.fechar.mockResolvedValue(true)
    sprints.garantir.mockResolvedValue(sprint({ id: 'spr-2' }))
    sprints.marcarFechamentoAplicado.mockResolvedValue(undefined)
    await new FecharSprintsVencidos(sprints, ocorrenciasRepo as never, tarefasRepo, padrao).execute(USER, SEXTA_2359)
    const gravada = sprints.fechar.mock.calls[0]![2] as FotoDoSprint

    // Depois: as tarefas somem (excluídas/arquivadas) e o histórico não consulta mais nada delas.
    tarefasRepo.listar.mockResolvedValue([])
    sprints.listarFechados.mockResolvedValue({ sprints: [sprint({ situacao: 'FECHADO', foto: gravada })], total: 1 })
    const { items } = await caso.execute(USER, 1, 10)

    expect(items[0]!.tarefas.itens.map((t) => t.id)).toEqual(['a', 'b'])
    expect(items[0]).toMatchObject({ recompensa: 'Pizza', tarefas: { naoConcluidas: 1 } })
    expect(tarefasRepo.listar).toHaveBeenCalledTimes(1)
  })
})
