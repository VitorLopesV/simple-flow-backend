import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ObterAlertasDoSino } from '../../../../src/application/use-cases/alertas/ObterAlertasDoSino'

// Novembro/2026: segunda 16, sexta 20, sábado 21, domingo 22, segunda 23. São Paulo = UTC-3.
const SPRINT_ABERTO = { id: 's1', inicio: '2026-11-16', fim: '2026-11-20', situacao: 'ABERTO', foto: null, fechadoEm: null }

function ocorrencia(sobrescritas: Record<string, unknown> = {}) {
  return { id: 'o1', itemId: 'i1', nome: 'Treino', data: '2026-11-17', hora: null, indice: 0, ordem: 0, concluidaEm: null, ...sobrescritas }
}

function dadosDoSprint(sobrescritas: Record<string, unknown> = {}) {
  return { sprint: SPRINT_ABERTO, iniciado: true, previa: false, ocorrencias: [], lembretes: [], ...sobrescritas }
}

function tarefa(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 't1',
    titulo: 'Estudar',
    dia: '2026-11-17',
    hora: null,
    tempoEstimado: 60,
    dificuldade: 'MEDIA',
    prioridade: 'ALTA',
    concluida: false,
    atrasada: false,
    superTask: false,
    ...sobrescritas,
  }
}

function sprintFechado(sobrescritas: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    inicio: '2026-11-09',
    fim: '2026-11-13',
    situacao: 'FECHADO',
    fechadoEm: '2026-11-14T02:59:00Z', // sexta 23:59 SP
    foto: { total: 300, feitos: 285, percentual: 95, bonus: true, recompensa: 'Pizza' },
    ...sobrescritas,
  }
}

describe('ObterAlertasDoSino', () => {
  const obterSprint = { execute: vi.fn() }
  const tarefasDoSprint = { listar: vi.fn(), devolverNaoConcluidas: vi.fn() }
  const sprints = { listarFechados: vi.fn() }

  const usar = (agora: Date) => new ObterAlertasDoSino(obterSprint, tarefasDoSprint, sprints).execute('u1', agora)
  const ids = async (agora: Date) => (await usar(agora)).alertas.map((a) => a.id)

  beforeEach(() => {
    vi.resetAllMocks()
    obterSprint.execute.mockResolvedValue(dadosDoSprint())
    tarefasDoSprint.listar.mockResolvedValue([])
    sprints.listarFechados.mockResolvedValue({ sprints: [], total: 0 })
  })

  it('sem nada a avisar devolve a lista vazia com o "hoje" de São Paulo', async () => {
    // 01:00Z de terça = 22:00 de segunda em SP
    expect(await usar(new Date('2026-11-17T01:00:00Z'))).toEqual({ hoje: '2026-11-16', alertas: [] })
  })

  it('consulta tudo só do usuário informado e pelo sprint atual (que fecha o vencido)', async () => {
    const agora = new Date('2026-11-17T15:00:00Z')

    await usar(agora)

    expect(obterSprint.execute).toHaveBeenCalledWith('u1', 'ATUAL', agora)
    expect(tarefasDoSprint.listar).toHaveBeenCalledWith('u1', 's1', '2026-11-16', '2026-11-20')
    expect(sprints.listarFechados).toHaveBeenCalledWith('u1', 1, 1)
  })

  describe('tarefa atrasada', () => {
    it('com hora: só alerta depois de início + tempo estimado (exatamente no limite não alerta)', async () => {
      tarefasDoSprint.listar.mockResolvedValue([tarefa({ hora: '09:00', tempoEstimado: 60 })]) // limite 10:00 SP = 13:00Z

      expect(await ids(new Date('2026-11-17T13:00:00Z'))).toEqual([])
      const depois = await usar(new Date('2026-11-17T13:01:00Z'))

      expect(depois.alertas).toEqual([
        {
          id: 'tarefa-atrasada:t1:2026-11-17',
          tipo: 'TAREFA_ATRASADA',
          titulo: 'Tarefa atrasada',
          descricao: '"Estudar" venceu em 17/11 às 09:00. Concluir agora vale só 20% dos pontos.',
          data: '2026-11-17',
        },
      ])
    })

    it('sem hora: não alerta durante o próprio dia (até 23:59 SP) e alerta na virada à meia-noite de SP', async () => {
      tarefasDoSprint.listar.mockResolvedValue([tarefa()])

      expect(await ids(new Date('2026-11-18T02:59:59Z'))).toEqual([]) // 23:59:59 de terça em SP
      const virada = await usar(new Date('2026-11-18T03:00:00Z')) // 00:00 de quarta em SP

      expect(virada.alertas.map((a) => a.id)).toEqual(['tarefa-atrasada:t1:2026-11-17'])
      expect(virada.alertas[0]!.descricao).toBe('"Estudar" venceu em 17/11. Concluir agora vale só 20% dos pontos.')
    })

    it('some quando a tarefa é concluída', async () => {
      tarefasDoSprint.listar.mockResolvedValue([tarefa({ concluida: true, atrasada: true })])

      expect(await ids(new Date('2026-11-19T15:00:00Z'))).toEqual([])
    })

    it('replanejar para outro dia move o prazo: some e o id muda', async () => {
      tarefasDoSprint.listar.mockResolvedValue([tarefa({ dia: '2026-11-17' })])
      const antes = await ids(new Date('2026-11-18T15:00:00Z'))
      tarefasDoSprint.listar.mockResolvedValue([tarefa({ dia: '2026-11-19' })])
      const depois = await ids(new Date('2026-11-18T15:00:00Z'))

      expect(antes).toEqual(['tarefa-atrasada:t1:2026-11-17'])
      expect(depois).toEqual([])
    })

    it('ignora Super task, tarefa de fim de semana e a que ainda está no prazo', async () => {
      tarefasDoSprint.listar.mockResolvedValue([
        tarefa({ id: 'super', superTask: true }),
        tarefa({ id: 'sabado', dia: '2026-11-14' }),
        tarefa({ id: 'amanha', dia: '2026-11-19' }),
      ])

      expect(await ids(new Date('2026-11-18T15:00:00Z'))).toEqual([])
    })

    it('é um alerta por tarefa, com ids estáveis entre chamadas', async () => {
      tarefasDoSprint.listar.mockResolvedValue([tarefa({ id: 'b' }), tarefa({ id: 'a', dia: '2026-11-16' })])
      const agora = new Date('2026-11-18T15:00:00Z')

      const primeira = await ids(agora)
      const segunda = await ids(new Date('2026-11-18T18:00:00Z'))

      expect(primeira).toEqual(['tarefa-atrasada:b:2026-11-17', 'tarefa-atrasada:a:2026-11-16'])
      expect(segunda).toEqual(primeira)
    })

    it('sprint fechado (sábado) ou ainda prévia não gera alerta nem consulta as tarefas', async () => {
      tarefasDoSprint.listar.mockResolvedValue([tarefa()])
      obterSprint.execute.mockResolvedValue(dadosDoSprint({ sprint: sprintFechado() }))
      expect(await ids(new Date('2026-11-21T15:00:00Z'))).toEqual([])
      obterSprint.execute.mockResolvedValue(dadosDoSprint({ previa: true, iniciado: false }))
      expect(await ids(new Date('2026-11-15T15:00:00Z'))).toEqual([])
      expect(tarefasDoSprint.listar).not.toHaveBeenCalled()
    })
  })

  describe('rotina incompleta', () => {
    const pendente = [ocorrencia({ id: 'a' }), ocorrencia({ id: 'b', concluidaEm: '2026-11-17T12:00:00Z' })]

    it('só a partir das 20:00 de SP (19:59 não, 20:00 sim)', async () => {
      obterSprint.execute.mockResolvedValue(dadosDoSprint({ ocorrencias: pendente }))

      expect(await ids(new Date('2026-11-17T22:59:59Z'))).toEqual([]) // 19:59:59 SP
      const noHorario = await usar(new Date('2026-11-17T23:00:00Z')) // 20:00:00 SP

      expect(noHorario.alertas).toEqual([
        {
          id: 'rotina-incompleta:2026-11-17',
          tipo: 'ROTINA_INCOMPLETA',
          titulo: 'Rotina de hoje incompleta',
          descricao: 'Você concluiu 1 de 2 itens da rotina. Cumpra a missão do dia para pontuar.',
          data: '2026-11-17',
        },
      ])
    })

    it('usa o dia de SP: 02:00Z de quarta ainda é terça à noite', async () => {
      obterSprint.execute.mockResolvedValue(dadosDoSprint({ ocorrencias: pendente }))

      expect(await ids(new Date('2026-11-18T02:00:00Z'))).toEqual(['rotina-incompleta:2026-11-17'])
    })

    it('some quando a missão é cumprida e na virada do dia (00:00 SP)', async () => {
      obterSprint.execute.mockResolvedValue(
        dadosDoSprint({ ocorrencias: [ocorrencia({ concluidaEm: '2026-11-17T23:10:00Z' })] }),
      )
      expect(await ids(new Date('2026-11-17T23:30:00Z'))).toEqual([])

      obterSprint.execute.mockResolvedValue(dadosDoSprint({ ocorrencias: pendente }))
      expect(await ids(new Date('2026-11-18T03:00:00Z'))).toEqual([]) // quarta 00:00 SP: a de quarta ainda não existe
    })

    it('ignora ocorrências de outros dias, dia sem rotina e lembretes', async () => {
      obterSprint.execute.mockResolvedValue(
        dadosDoSprint({
          ocorrencias: [ocorrencia({ data: '2026-11-16' })],
          lembretes: [ocorrencia({ data: '2026-11-17' })],
        }),
      )

      expect(await ids(new Date('2026-11-17T23:30:00Z'))).toEqual([])
    })

    it('não alerta no fim de semana (sábado à noite, sprint fechado)', async () => {
      obterSprint.execute.mockResolvedValue(dadosDoSprint({ sprint: sprintFechado(), ocorrencias: [ocorrencia({ data: '2026-11-21' })] }))
      sprints.listarFechados.mockResolvedValue({ sprints: [], total: 0 })

      expect(await ids(new Date('2026-11-22T01:00:00Z'))).toEqual([])
    })

    it('sexta 20:00 ainda alerta (último dia útil)', async () => {
      obterSprint.execute.mockResolvedValue(dadosDoSprint({ ocorrencias: [ocorrencia({ data: '2026-11-20' })] }))

      expect(await ids(new Date('2026-11-20T23:00:00Z'))).toEqual(['rotina-incompleta:2026-11-20'])
    })
  })

  describe('resultado do sprint', () => {
    it('bônus liberado, com a recompensa da foto', async () => {
      sprints.listarFechados.mockResolvedValue({ sprints: [sprintFechado()], total: 1 })

      const { alertas } = await usar(new Date('2026-11-14T15:00:00Z')) // sábado

      expect(alertas).toEqual([
        {
          id: 'resultado-sprint:f1',
          tipo: 'RESULTADO_SPRINT',
          titulo: 'Bônus do sprint liberado',
          descricao: 'Você fechou o sprint de 09/11 com 95%. Recompensa: Pizza.',
          data: '2026-11-13',
        },
      ])
    })

    it('bônus liberado sem recompensa não menciona recompensa', async () => {
      sprints.listarFechados.mockResolvedValue({
        sprints: [sprintFechado({ foto: { total: 300, feitos: 285, percentual: 95, bonus: true, recompensa: null } })],
        total: 1,
      })

      const { alertas } = await usar(new Date('2026-11-14T15:00:00Z'))

      expect(alertas[0]!.descricao).toBe('Você fechou o sprint de 09/11 com 95%.')
    })

    it('bônus não liberado', async () => {
      sprints.listarFechados.mockResolvedValue({
        sprints: [sprintFechado({ foto: { total: 300, feitos: 240, percentual: 80, bonus: false, recompensa: 'Pizza' } })],
        total: 1,
      })

      const { alertas } = await usar(new Date('2026-11-14T15:00:00Z'))

      expect(alertas[0]).toMatchObject({
        id: 'resultado-sprint:f1',
        titulo: 'Bônus do sprint não liberado',
        descricao: 'O sprint de 09/11 fechou com 80% (meta: 90%).',
      })
    })

    it('data do alerta é o dia de SP do fechamento; sem fechadoEm, o dia seguinte ao fim', async () => {
      sprints.listarFechados.mockResolvedValue({ sprints: [sprintFechado({ fechadoEm: '2026-11-14T02:59:00Z' })], total: 1 })
      expect((await usar(new Date('2026-11-14T15:00:00Z'))).alertas[0]!.data).toBe('2026-11-13')

      sprints.listarFechados.mockResolvedValue({ sprints: [sprintFechado({ fechadoEm: null })], total: 1 })
      expect((await usar(new Date('2026-11-14T15:00:00Z'))).alertas[0]!.data).toBe('2026-11-14')
    })

    it('aparece do fechamento até o domingo da semana seguinte e some na segunda depois', async () => {
      sprints.listarFechados.mockResolvedValue({ sprints: [sprintFechado()], total: 1 })

      expect(await ids(new Date('2026-11-14T03:00:00Z'))).toEqual(['resultado-sprint:f1']) // sábado 00:00 SP
      expect(await ids(new Date('2026-11-16T15:00:00Z'))).toEqual(['resultado-sprint:f1']) // semana seguinte
      expect(await ids(new Date('2026-11-23T02:59:59Z'))).toEqual(['resultado-sprint:f1']) // domingo 23:59 SP
      expect(await ids(new Date('2026-11-23T03:00:00Z'))).toEqual([]) // segunda 00:00 SP
    })

    it('sprint fechado sem foto não gera alerta', async () => {
      sprints.listarFechados.mockResolvedValue({ sprints: [sprintFechado({ foto: null })], total: 1 })

      expect(await ids(new Date('2026-11-14T15:00:00Z'))).toEqual([])
    })
  })

  it('ordena por data (mais recente primeiro) e, no mesmo dia, resultado, rotina e tarefa', async () => {
    obterSprint.execute.mockResolvedValue(dadosDoSprint({ ocorrencias: [ocorrencia({ data: '2026-11-18' })] }))
    tarefasDoSprint.listar.mockResolvedValue([
      tarefa({ id: 'z', dia: '2026-11-18', hora: '08:00', tempoEstimado: 15 }),
      tarefa({ id: 'a', dia: '2026-11-18', hora: '09:00', tempoEstimado: 15 }),
      tarefa({ id: 'velha', dia: '2026-11-16' }),
    ])
    sprints.listarFechados.mockResolvedValue({
      sprints: [sprintFechado({ inicio: '2026-11-09', fechadoEm: '2026-11-19T02:59:00Z' })],
      total: 1,
    })

    expect(await ids(new Date('2026-11-18T23:30:00Z'))).toEqual([
      'resultado-sprint:f1', // data 2026-11-18 (fechadoEm ajustado)
      'rotina-incompleta:2026-11-18',
      'tarefa-atrasada:a:2026-11-18',
      'tarefa-atrasada:z:2026-11-18',
      'tarefa-atrasada:velha:2026-11-16',
    ])
  })
})
