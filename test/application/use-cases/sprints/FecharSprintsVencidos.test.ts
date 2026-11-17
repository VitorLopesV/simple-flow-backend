import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FecharSprintsVencidos } from '../../../../src/application/use-cases/sprints/FecharSprintsVencidos'
import type { TarefaDoSprint } from '../../../../src/domain/entities/PlacarDoSprint'
import type { Sprint } from '../../../../src/domain/entities/Sprint'
import { pontosDaTarefa } from '../../../../src/domain/services/pontuacao'
import { criarOcorrenciaRotinaRepositoryFake, criarRecompensaPadraoRepositoryFake, criarSprintRepositoryFake } from '../../../helpers/repositoriosFake'

const USER = 'u1'
const SEXTA_2359 = new Date('2026-11-21T02:59:00Z') // sexta 23:59 SP
const SEXTA_2358 = new Date('2026-11-21T02:58:59Z')

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

function ocorrencia(data: string, concluida: boolean, lembrete = false) {
  return { data, concluidaEm: concluida ? `${data}T12:00:00Z` : null, lembrete }
}

function tarefa(
  id: string,
  tempo: TarefaDoSprint['tempoEstimado'],
  dificuldade: TarefaDoSprint['dificuldade'],
  prioridade: TarefaDoSprint['prioridade'],
  concluida: boolean,
): TarefaDoSprint {
  return { id, titulo: `Tarefa ${id}`, dia: '2026-11-18', hora: null, tempoEstimado: tempo, dificuldade, prioridade, concluida, atrasada: false, superTask: false }
}

describe('FecharSprintsVencidos', () => {
  const sprints = criarSprintRepositoryFake()
  const ocorrencias = criarOcorrenciaRotinaRepositoryFake()
  const tarefas = { listar: vi.fn(), devolverNaoConcluidas: vi.fn() }
  const padrao = criarRecompensaPadraoRepositoryFake()
  const caso = new FecharSprintsVencidos(sprints, ocorrencias as never, tarefas, padrao)

  beforeEach(() => {
    vi.resetAllMocks()
    sprints.listarPendentesDeFechamento.mockResolvedValue([sprint()])
    sprints.fechar.mockResolvedValue(true)
    sprints.garantir.mockResolvedValue(sprint({ id: 'spr-2' }))
    sprints.marcarFechamentoAplicado.mockResolvedValue(undefined)
    ocorrencias.listarDoSprint.mockResolvedValue([])
    tarefas.listar.mockResolvedValue([])
    tarefas.devolverNaoConcluidas.mockResolvedValue(undefined)
    padrao.obter.mockResolvedValue(null)
  })

  it('exemplo da issue: 300 pts no total e 240 feitos dão 80%, sem bônus', async () => {
    // Rotina: 5 dias úteis cumpridos = 200. Tarefas: 100 no total, 40 feitos (24 + 16); 60 abertas (39 + 19 + 2).
    ocorrencias.listarDoSprint.mockResolvedValue(
      ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].map((d) => ocorrencia(d, true)),
    )
    tarefas.listar.mockResolvedValue([
      tarefa('a', 120, 'DIFICIL', 'ALTA', true),
      tarefa('b', 240, 'FACIL', 'MEDIA', true),
      tarefa('c', 240, 'DIFICIL', 'ALTA', false),
      tarefa('d', 120, 'DIFICIL', 'MEDIA', false),
      tarefa('e', 15, 'FACIL', 'BAIXA', false),
    ])
    expect(pontosDaTarefa({ tempoEstimado: 120, dificuldade: 'DIFICIL', prioridade: 'ALTA' })).toBe(24)

    await caso.execute(USER, SEXTA_2359)

    const foto = sprints.fechar.mock.calls[0]![2]
    expect(foto).toMatchObject({ total: 300, feitos: 240, percentual: 80, bonus: false })
    expect(foto.tarefas).toEqual({ quantidade: 5, concluidas: 2, total: 100, feitos: 40 })
  })

  it('a foto leva as não concluídas no total ANTES de elas saírem do sprint (ordem obrigatória)', async () => {
    tarefas.listar.mockResolvedValue([tarefa('a', 60, 'DIFICIL', 'ALTA', true), tarefa('b', 60, 'DIFICIL', 'ALTA', false)])

    await caso.execute(USER, SEXTA_2359)

    expect(sprints.fechar.mock.calls[0]![2]).toMatchObject({ total: 30, feitos: 15, percentual: 50 })
    const ordem = [
      tarefas.listar,
      sprints.fechar,
      tarefas.devolverNaoConcluidas,
      sprints.garantir,
      sprints.marcarFechamentoAplicado,
    ].map((fn) => fn.mock.invocationCallOrder[0]!)
    expect([...ordem].sort((x, y) => x - y)).toEqual(ordem)
  })

  it('devolve as não concluídas com a marca do sprint de origem e cria o próximo sprint', async () => {
    await caso.execute(USER, SEXTA_2359)

    expect(tarefas.devolverNaoConcluidas).toHaveBeenCalledWith(USER, 'spr-1', '2026-11-16')
    expect(sprints.garantir).toHaveBeenCalledWith(USER, '2026-11-23', '2026-11-27')
    expect(sprints.fechar).toHaveBeenCalledWith(USER, 'spr-1', expect.anything(), SEXTA_2359.toISOString())
    expect(sprints.marcarFechamentoAplicado).toHaveBeenCalledWith(USER, 'spr-1', SEXTA_2359.toISOString())
  })

  it('borda do bônus: exatamente 90% libera; 85% não libera', async () => {
    // 60 min FACIL BAIXA vale 5: 18 de 20 = 90/100 e 17 de 20 = 85/100.
    tarefas.listar.mockResolvedValue(Array.from({ length: 20 }, (_, i) => tarefa(`t${i}`, 60, 'FACIL', 'BAIXA', i < 18)))
    await caso.execute(USER, SEXTA_2359)
    expect(sprints.fechar.mock.calls[0]![2]).toMatchObject({ total: 100, feitos: 90, percentual: 90, bonus: true })

    sprints.fechar.mockClear()
    tarefas.listar.mockResolvedValue(Array.from({ length: 20 }, (_, i) => tarefa(`t${i}`, 60, 'FACIL', 'BAIXA', i < 17)))
    await caso.execute(USER, SEXTA_2359)
    expect(sprints.fechar.mock.calls[0]![2]).toMatchObject({ total: 100, feitos: 85, percentual: 85, bonus: false })
  })

  it('total 0 (nada planejado): 0%, sem bônus', async () => {
    await caso.execute(USER, SEXTA_2359)

    expect(sprints.fechar.mock.calls[0]![2]).toMatchObject({ total: 0, feitos: 0, percentual: 0, bonus: false })
  })

  it('rotina de sábado/domingo (lembrete) não conta na foto', async () => {
    ocorrencias.listarDoSprint.mockResolvedValue([ocorrencia('2026-11-16', true), ocorrencia('2026-11-21', false, true)])

    await caso.execute(USER, SEXTA_2359)

    expect(sprints.fechar.mock.calls[0]![2].rotina).toMatchObject({ diasComRotina: 1, diasCumpridos: 1, total: 40 })
  })

  it('rotina não concluída fica zerada: o dia vale 0 nos feitos, mas conta no total', async () => {
    ocorrencias.listarDoSprint.mockResolvedValue([ocorrencia('2026-11-16', true), ocorrencia('2026-11-17', false)])

    await caso.execute(USER, SEXTA_2359)

    expect(sprints.fechar.mock.calls[0]![2]).toMatchObject({ total: 80, feitos: 40, percentual: 50 })
  })

  it('antes de sexta 23:59 (SP) não fecha nada, nem devolve tarefas', async () => {
    const fechados = await caso.execute(USER, SEXTA_2358)

    expect(fechados).toBe(0)
    expect(sprints.fechar).not.toHaveBeenCalled()
    expect(tarefas.devolverNaoConcluidas).not.toHaveBeenCalled()
    expect(sprints.marcarFechamentoAplicado).not.toHaveBeenCalled()
  })

  it('consulta só os sprints do usuário com fim até hoje (SP)', async () => {
    await caso.execute(USER, SEXTA_2359)

    expect(sprints.listarPendentesDeFechamento).toHaveBeenCalledWith(USER, '2026-11-20')
  })

  it('idempotente: sem pendências (já aplicado) não faz nada ao rodar de novo', async () => {
    sprints.listarPendentesDeFechamento.mockResolvedValue([])

    expect(await caso.execute(USER, SEXTA_2359)).toBe(0)
    expect(await caso.execute(USER, SEXTA_2359)).toBe(0)
    expect(sprints.fechar).not.toHaveBeenCalled()
    expect(tarefas.devolverNaoConcluidas).not.toHaveBeenCalled()
  })

  it('retoma fechamento interrompido: sprint já FECHADO não regrava a foto, só refaz devolução e próximo sprint', async () => {
    sprints.listarPendentesDeFechamento.mockResolvedValue([sprint({ situacao: 'FECHADO', fechadoEm: 'x' })])

    const fechados = await caso.execute(USER, SEXTA_2359)

    expect(fechados).toBe(0)
    expect(sprints.fechar).not.toHaveBeenCalled()
    expect(ocorrencias.listarDoSprint).not.toHaveBeenCalled()
    expect(tarefas.listar).not.toHaveBeenCalled()
    expect(tarefas.devolverNaoConcluidas).toHaveBeenCalledWith(USER, 'spr-1', '2026-11-16')
    expect(sprints.marcarFechamentoAplicado).toHaveBeenCalledTimes(1)
  })

  it('se o job fechou entre a leitura e a gravação, `fechar` devolve false e a foto do job vale', async () => {
    sprints.fechar.mockResolvedValue(false)

    expect(await caso.execute(USER, SEXTA_2359)).toBe(0)
    expect(sprints.marcarFechamentoAplicado).toHaveBeenCalledTimes(1)
  })

  it('fecha vários sprints vencidos, do mais antigo ao mais novo, e conta os que fechou', async () => {
    sprints.listarPendentesDeFechamento.mockResolvedValue([
      sprint({ id: 'a', inicio: '2026-11-09', fim: '2026-11-13' }),
      sprint({ id: 'b' }),
    ])

    expect(await caso.execute(USER, new Date('2026-11-24T12:00:00Z'))).toBe(2)
    expect(sprints.fechar.mock.calls.map((c) => c[1])).toEqual(['a', 'b'])
  })

  it('propaga erro do repositório sem marcar o fechamento como aplicado (a reserva retoma depois)', async () => {
    const erro = new Error('falha')
    tarefas.devolverNaoConcluidas.mockRejectedValue(erro)

    await expect(caso.execute(USER, SEXTA_2359)).rejects.toBe(erro)
    expect(sprints.marcarFechamentoAplicado).not.toHaveBeenCalled()
  })
})
