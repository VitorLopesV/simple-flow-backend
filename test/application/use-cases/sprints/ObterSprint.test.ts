import { beforeEach, describe, expect, it } from 'vitest'

import { ObterSprint } from '../../../../src/application/use-cases/sprints/ObterSprint'
import type { ItemRotina } from '../../../../src/domain/entities/ItemRotina'
import type { OcorrenciaPlanejada, OcorrenciaRotina } from '../../../../src/domain/entities/OcorrenciaRotina'
import type { Sprint } from '../../../../src/domain/entities/Sprint'
import {
  criarItemRotinaRepositoryFake,
  criarOcorrenciaRotinaRepositoryFake,
  criarSprintRepositoryFake,
} from '../../../helpers/repositoriosFake'

const USER = 'user-1'
// 2026-11-16 é segunda. Instantes em UTC; São Paulo é UTC-3.
const DOMINGO_2330_SP = new Date('2026-11-23T02:30:00Z') // domingo 22/11 23:30 SP
const SEGUNDA_0000_SP = new Date('2026-11-23T03:00:00Z') // segunda 23/11 00:00 SP
const QUARTA = new Date('2026-11-18T15:00:00Z')
const SEXTA_2359_SP = new Date('2026-11-21T02:59:00Z') // sexta 20/11 23:59 SP
const SABADO_0000_SP = new Date('2026-11-21T03:00:00Z')

const ITEM: ItemRotina = {
  id: 'rot-1',
  areaId: 'area-rotina',
  nome: 'Remédio',
  repeticao: { modo: 'DIAS_DA_SEMANA', dias: [1, 3] },
  vezes: [{ hora: '08:00' }],
  criadoEm: '2026-01-01T00:00:00.000Z',
}

function sprint(inicio: string, fim: string, rotinaGeradaEm: string | null = null): Sprint {
  return { id: `spr-${inicio}`, inicio, fim, situacao: 'ABERTO', rotinaGeradaEm, criadoEm: '2026-01-01T00:00:00.000Z', recompensa: null, fechadoEm: null, foto: null, fechamentoAplicadoEm: null }
}

function gravada(sobrescritas: Partial<OcorrenciaRotina> = {}): OcorrenciaRotina {
  return {
    id: 'oco-1',
    sprintId: 'spr-2026-11-16',
    itemId: 'rot-1',
    nome: 'Remédio',
    data: '2026-11-16',
    hora: '08:00',
    indice: 0,
    ordem: 0,
    lembrete: false,
    concluidaEm: null,
    ...sobrescritas,
  }
}

describe('ObterSprint', () => {
  const sprints = criarSprintRepositoryFake()
  const ocorrencias = criarOcorrenciaRotinaRepositoryFake()
  const itens = criarItemRotinaRepositoryFake()
  const casoDeUso = new ObterSprint(sprints, ocorrencias, itens)

  beforeEach(() => {
    sprints.garantir.mockReset().mockImplementation(async (_u: string, inicio: string, fim: string) => sprint(inicio, fim))
    sprints.marcarRotinaGerada.mockReset().mockResolvedValue(undefined)
    ocorrencias.listarDoSprint.mockReset().mockResolvedValue([])
    ocorrencias.inserirVarias.mockReset().mockResolvedValue(undefined)
    itens.listar.mockReset().mockResolvedValue([ITEM])
  })

  it('atual na quarta: sprint de segunda a sexta da semana, gera a rotina e devolve o que foi gravado', async () => {
    ocorrencias.listarDoSprint.mockResolvedValue([gravada(), gravada({ id: 'oco-2', lembrete: true, data: '2026-11-22' })])

    const r = await casoDeUso.execute(USER, 'ATUAL', QUARTA)

    expect(sprints.garantir).toHaveBeenCalledWith(USER, '2026-11-16', '2026-11-20')
    expect(ocorrencias.inserirVarias).toHaveBeenCalledTimes(1)
    const [usuario, sprintId, geradas, lembretes] = ocorrencias.inserirVarias.mock.calls[0] as [string, string, OcorrenciaPlanejada[], unknown[]]
    expect([usuario, sprintId]).toEqual([USER, 'spr-2026-11-16'])
    expect(geradas.map((o) => o.data)).toEqual(['2026-11-16', '2026-11-18'])
    expect(lembretes).toEqual([])
    expect(sprints.marcarRotinaGerada).toHaveBeenCalledWith(USER, 'spr-2026-11-16', QUARTA.toISOString())
    expect(r).toMatchObject({ iniciado: true, previa: false })
    expect(r.sprint.rotinaGeradaEm).toBe(QUARTA.toISOString())
    expect(r.ocorrencias).toHaveLength(1)
    expect(r.ocorrencias[0]).toEqual({
      id: 'oco-1', itemId: 'rot-1', nome: 'Remédio', data: '2026-11-16', hora: '08:00', indice: 0, ordem: 0, concluidaEm: null,
    })
    expect(r.lembretes.map((l) => l.id)).toEqual(['oco-2'])
  })

  it('idempotente: sprint já gerado não regrava nem relê a rotina', async () => {
    sprints.garantir.mockResolvedValue(sprint('2026-11-16', '2026-11-20', '2026-11-16T10:00:00.000Z'))
    ocorrencias.listarDoSprint.mockResolvedValue([gravada()])

    const primeira = await casoDeUso.execute(USER, 'ATUAL', QUARTA)
    const segunda = await casoDeUso.execute(USER, 'ATUAL', QUARTA)

    expect(ocorrencias.inserirVarias).not.toHaveBeenCalled()
    expect(sprints.marcarRotinaGerada).not.toHaveBeenCalled()
    expect(itens.listar).not.toHaveBeenCalled()
    expect(segunda).toEqual(primeira)
  })

  it('alterar a rotina depois da geração não muda o sprint: devolve as ocorrências gravadas', async () => {
    sprints.garantir.mockResolvedValue(sprint('2026-11-16', '2026-11-20', '2026-11-16T10:00:00.000Z'))
    ocorrencias.listarDoSprint.mockResolvedValue([gravada({ nome: 'Nome antigo' })])
    itens.listar.mockResolvedValue([{ ...ITEM, nome: 'Nome novo', repeticao: { modo: 'DIAS_DA_SEMANA', dias: [2] } }])

    const r = await casoDeUso.execute(USER, 'ATUAL', QUARTA)

    expect(r.ocorrencias.map((o) => o.nome)).toEqual(['Nome antigo'])
    expect(itens.listar).not.toHaveBeenCalled()
  })

  it('domingo 23:30 (SP) ainda é a semana que acaba; o próximo sprint começa na segunda seguinte e só tem prévia', async () => {
    const atual = await casoDeUso.execute(USER, 'ATUAL', DOMINGO_2330_SP)
    expect(sprints.garantir).toHaveBeenLastCalledWith(USER, '2026-11-16', '2026-11-20')
    expect(atual.iniciado).toBe(true)

    const proximo = await casoDeUso.execute(USER, 'PROXIMO', DOMINGO_2330_SP)
    expect(sprints.garantir).toHaveBeenLastCalledWith(USER, '2026-11-23', '2026-11-27')
    expect(proximo).toMatchObject({ iniciado: false, previa: true })
  })

  it('segunda 00:00 (SP): a semana nova passa a ser a atual e a rotina é gerada', async () => {
    const r = await casoDeUso.execute(USER, 'ATUAL', SEGUNDA_0000_SP)

    expect(sprints.garantir).toHaveBeenCalledWith(USER, '2026-11-23', '2026-11-27')
    expect(r).toMatchObject({ iniciado: true, previa: false })
    expect(ocorrencias.inserirVarias).toHaveBeenCalledTimes(1)
  })

  it('sexta 23:59 (SP) é a mesma semana; sábado 00:00 continua nela e o próximo é a segunda seguinte', async () => {
    await casoDeUso.execute(USER, 'ATUAL', SEXTA_2359_SP)
    expect(sprints.garantir).toHaveBeenLastCalledWith(USER, '2026-11-16', '2026-11-20')
    await casoDeUso.execute(USER, 'ATUAL', SABADO_0000_SP)
    expect(sprints.garantir).toHaveBeenLastCalledWith(USER, '2026-11-16', '2026-11-20')
    await casoDeUso.execute(USER, 'PROXIMO', SABADO_0000_SP)
    expect(sprints.garantir).toHaveBeenLastCalledWith(USER, '2026-11-23', '2026-11-27')
  })

  it('prévia: calcula da configuração atual, sem ids, e não grava nada', async () => {
    itens.listar.mockResolvedValue([
      ITEM,
      { ...ITEM, id: 'rot-2', nome: 'Regar', repeticao: { modo: 'A_CADA_N_DIAS', intervalo: 6, dataInicial: '2026-11-23' }, vezes: [{ hora: null }] },
    ])

    const r = await casoDeUso.execute(USER, 'PROXIMO', QUARTA)

    expect(r.previa).toBe(true)
    expect(r.sprint.rotinaGeradaEm).toBeNull()
    expect(r.ocorrencias.map((o) => [o.nome, o.data])).toEqual([
      ['Regar', '2026-11-23'],
      ['Remédio', '2026-11-23'],
      ['Remédio', '2026-11-25'],
    ])
    expect(r.ocorrencias.every((o) => o.id === null && o.concluidaEm === null)).toBe(true)
    expect(r.lembretes.map((o) => [o.nome, o.data])).toEqual([['Regar', '2026-11-29']])
    expect(ocorrencias.inserirVarias).not.toHaveBeenCalled()
    expect(sprints.marcarRotinaGerada).not.toHaveBeenCalled()
    expect(ocorrencias.listarDoSprint).not.toHaveBeenCalled()
  })

  it('lembretes de fim de semana (a cada N dias) aparecem à parte na prévia', async () => {
    itens.listar.mockResolvedValue([
      { ...ITEM, repeticao: { modo: 'A_CADA_N_DIAS', intervalo: 2, dataInicial: '2026-11-23' }, vezes: [{ hora: null }] },
    ])

    const r = await casoDeUso.execute(USER, 'PROXIMO', QUARTA)

    expect(r.ocorrencias.map((o) => o.data)).toEqual(['2026-11-23', '2026-11-25', '2026-11-27'])
    expect(r.lembretes.map((o) => o.data)).toEqual(['2026-11-29'])
  })

  it('propaga erro do repositório sem marcar o sprint como gerado', async () => {
    const erro = new Error('falha')
    ocorrencias.inserirVarias.mockRejectedValue(erro)

    await expect(casoDeUso.execute(USER, 'ATUAL', QUARTA)).rejects.toBe(erro)
    expect(sprints.marcarRotinaGerada).not.toHaveBeenCalled()
  })

  it('usa o relógio real quando não recebe o instante', async () => {
    const r = await casoDeUso.execute(USER, 'ATUAL')
    expect(r.sprint.inicio <= new Date().toISOString().slice(0, 10)).toBe(true)
  })
})
