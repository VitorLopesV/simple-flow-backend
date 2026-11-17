import { describe, expect, it } from 'vitest'

import { AdicionarTarefaAoSprint } from '../../../../src/application/use-cases/sprints/AdicionarTarefaAoSprint'
import { EntrarNoSprintPorConclusao } from '../../../../src/application/use-cases/sprints/EntrarNoSprintPorConclusao'
import { MoverTarefaNoSprint } from '../../../../src/application/use-cases/sprints/MoverTarefaNoSprint'
import { RemoverTarefaDoSprint } from '../../../../src/application/use-cases/sprints/RemoverTarefaDoSprint'
import { ArquivarTarefa } from '../../../../src/application/use-cases/tarefas/ArquivarTarefa'
import { AtualizarTarefa } from '../../../../src/application/use-cases/tarefas/AtualizarTarefa'
import { CriarTarefa } from '../../../../src/application/use-cases/tarefas/CriarTarefa'
import { MoverTarefa } from '../../../../src/application/use-cases/tarefas/MoverTarefa'
import { RemoverTarefa } from '../../../../src/application/use-cases/tarefas/RemoverTarefa'
import type { Tarefa, TarefaEdicao } from '../../../../src/domain/entities/Tarefa'
import { ConflictError, NotFoundError, ValidationError } from '../../../../src/domain/errors/DomainError'
import { MENSAGEM_TAREFA_TRAVADA } from '../../../../src/domain/services/sprintDaTarefa'
import {
  criarAreaRepositoryFake,
  criarSprintRepositoryFake,
  criarSuperTaskRepositoryFake,
  criarTarefaRepositoryFake,
} from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
// Quarta 2026-11-18 12:00 em São Paulo. Sprint atual 16–20, próximo 23–27.
const QUARTA = new Date('2026-11-18T15:00:00.000Z')

/** Instantes de virada em São Paulo (UTC-3). */
const QUARTA_23H59 = new Date('2026-11-19T02:59:00.000Z')
const QUINTA_00H00 = new Date('2026-11-19T03:00:00.000Z')
const SEXTA_23H59 = new Date('2026-11-21T02:59:00.000Z')
const SABADO_00H00 = new Date('2026-11-21T03:00:00.000Z')
const DOMINGO_23H59 = new Date('2026-11-23T02:59:00.000Z')
const SEGUNDA_00H00 = new Date('2026-11-23T03:00:00.000Z')

const COMPLETA: Tarefa = {
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
  naoConcluidaNoSprintDe: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}
const noSprint = (dia: string, extra: Partial<Tarefa> = {}): Tarefa => ({ ...COMPLETA, dia, sprintId: 'spr-atual', ...extra })
const edicaoDe = (t: Tarefa, extra: Partial<TarefaEdicao> = {}): TarefaEdicao => ({
  titulo: t.titulo,
  dia: t.dia,
  hora: t.hora,
  tempoEstimado: t.tempoEstimado,
  dificuldade: t.dificuldade,
  prioridade: t.prioridade,
  notas: t.notas,
  ...extra,
})

function montar(tarefa: Tarefa | null) {
  const tarefas = criarTarefaRepositoryFake()
  const sprints = criarSprintRepositoryFake()
  tarefas.buscarPorId.mockResolvedValue(tarefa)
  tarefas.definirSprint.mockImplementation(async (_u: string, _id: string, v: { sprintId: string | null; dia?: string }) => ({
    ...(tarefa ?? COMPLETA),
    sprintId: v.sprintId,
    ...(v.dia ? { dia: v.dia } : {}),
  }))
  tarefas.atualizar.mockImplementation(async (_u: string, _id: string, e: TarefaEdicao, s?: string | null) => ({
    ...(tarefa ?? COMPLETA),
    ...e,
    sprintId: s === undefined ? (tarefa?.sprintId ?? null) : s,
  }))
  sprints.garantir.mockImplementation(async (_u: string, inicio: string) => ({ id: `spr-${inicio}` }))
  return { tarefas, sprints }
}

describe('AdicionarTarefaAoSprint', () => {
  it('entra no sprint atual com o dia informado (hoje ou futuro)', async () => {
    const { tarefas, sprints } = montar(COMPLETA)

    await expect(new AdicionarTarefaAoSprint(tarefas, sprints).execute(USER_ID, 'tar-1', '2026-11-18', QUARTA)).resolves.toMatchObject({
      sprintId: 'spr-2026-11-16',
      dia: '2026-11-18',
    })
    expect(sprints.garantir).toHaveBeenCalledWith(USER_ID, '2026-11-16', '2026-11-20')
    expect(tarefas.definirSprint).toHaveBeenCalledWith(USER_ID, 'tar-1', { sprintId: 'spr-2026-11-16', dia: '2026-11-18' })
  })

  it('dia na semana seguinte entra no sprint próximo; sem dia no corpo usa o dia da tarefa', async () => {
    const { tarefas, sprints } = montar({ ...COMPLETA, dia: '2026-11-25' })

    await new AdicionarTarefaAoSprint(tarefas, sprints).execute(USER_ID, 'tar-1', undefined, QUARTA)
    expect(sprints.garantir).toHaveBeenCalledWith(USER_ID, '2026-11-23', '2026-11-27')
    expect(tarefas.definirSprint).toHaveBeenCalledWith(USER_ID, 'tar-1', { sprintId: 'spr-2026-11-23', dia: '2026-11-25' })
  })

  it.each([
    ['sem dia', undefined, {}, /Escolha um dia/],
    ['sábado', '2026-11-21', {}, /Sábado e domingo/],
    ['domingo', '2026-11-22', {}, /Sábado e domingo/],
    ['dia que já passou', '2026-11-17', {}, /já passou/],
    ['sprint além do próximo', '2026-11-30', {}, /desta semana e o da próxima/],
    ['sem tempo', '2026-11-19', { tempoEstimado: null }, /tempo estimado/],
    ['sem dificuldade', '2026-11-19', { dificuldade: null }, /dificuldade/],
    ['sem prioridade', '2026-11-19', { prioridade: null }, /prioridade/],
  ] as const)('recusa %s com mensagem clara e não escreve', async (_nome, dia, extra, mensagem) => {
    const { tarefas, sprints } = montar({ ...COMPLETA, ...extra })

    const erro = await new AdicionarTarefaAoSprint(tarefas, sprints).execute(USER_ID, 'tar-1', dia, QUARTA).catch((e) => e)
    expect(erro).toBeInstanceOf(ValidationError)
    expect(erro.message).toMatch(mensagem)
    expect(tarefas.definirSprint).not.toHaveBeenCalled()
    expect(sprints.garantir).not.toHaveBeenCalled()
  })

  it('a hora é opcional', async () => {
    const { tarefas, sprints } = montar({ ...COMPLETA, hora: null })
    await expect(new AdicionarTarefaAoSprint(tarefas, sprints).execute(USER_ID, 'tar-1', '2026-11-19', QUARTA)).resolves.toBeDefined()
  })

  it('recusa tarefa arquivada, tarefa já no sprint e tarefa travada', async () => {
    const arquivada = montar({ ...COMPLETA, arquivada: true })
    await expect(
      new AdicionarTarefaAoSprint(arquivada.tarefas, arquivada.sprints).execute(USER_ID, 'tar-1', '2026-11-19', QUARTA),
    ).rejects.toBeInstanceOf(ValidationError)

    const jaNoSprint = montar(noSprint('2026-11-19'))
    await expect(
      new AdicionarTarefaAoSprint(jaNoSprint.tarefas, jaNoSprint.sprints).execute(USER_ID, 'tar-1', '2026-11-20', QUARTA),
    ).rejects.toBeInstanceOf(ConflictError)

    const travada = montar(noSprint('2026-11-17'))
    await expect(
      new AdicionarTarefaAoSprint(travada.tarefas, travada.sprints).execute(USER_ID, 'tar-1', '2026-11-20', QUARTA),
    ).rejects.toThrow(MENSAGEM_TAREFA_TRAVADA)
  })

  it('NotFoundError para tarefa inexistente (inclui itens de rotina, que não são tarefas)', async () => {
    const { tarefas, sprints } = montar(null)
    await expect(new AdicionarTarefaAoSprint(tarefas, sprints).execute(USER_ID, 'x', '2026-11-19', QUARTA)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('no sábado só a semana seguinte aceita tarefas', async () => {
    const { tarefas, sprints } = montar(COMPLETA)
    const caso = new AdicionarTarefaAoSprint(tarefas, sprints)

    await expect(caso.execute(USER_ID, 'tar-1', '2026-11-20', SABADO_00H00)).rejects.toThrow(/já passou/)
    await expect(caso.execute(USER_ID, 'tar-1', '2026-11-23', SABADO_00H00)).resolves.toMatchObject({ sprintId: 'spr-2026-11-23' })
  })
})

describe('MoverTarefaNoSprint', () => {
  it('muda o dia dentro do sprint', async () => {
    const { tarefas, sprints } = montar(noSprint('2026-11-19'))

    await expect(new MoverTarefaNoSprint(tarefas, sprints).execute(USER_ID, 'tar-1', '2026-11-20', QUARTA)).resolves.toMatchObject({ dia: '2026-11-20' })
    expect(tarefas.definirSprint).toHaveBeenCalledWith(USER_ID, 'tar-1', { sprintId: 'spr-2026-11-16', dia: '2026-11-20' })
  })

  it('muda de um sprint para o outro quando o dia cai na outra semana', async () => {
    const { tarefas, sprints } = montar(noSprint('2026-11-19'))
    await new MoverTarefaNoSprint(tarefas, sprints).execute(USER_ID, 'tar-1', '2026-11-24', QUARTA)
    expect(tarefas.definirSprint).toHaveBeenCalledWith(USER_ID, 'tar-1', { sprintId: 'spr-2026-11-23', dia: '2026-11-24' })
  })

  it('recusa dia passado, fim de semana e fora do sprint', async () => {
    const { tarefas, sprints } = montar(noSprint('2026-11-19'))
    const caso = new MoverTarefaNoSprint(tarefas, sprints)

    await expect(caso.execute(USER_ID, 'tar-1', '2026-11-17', QUARTA)).rejects.toThrow(/já passou/)
    await expect(caso.execute(USER_ID, 'tar-1', '2026-11-21', QUARTA)).rejects.toThrow(/Sábado e domingo/)
    await expect(caso.execute(USER_ID, 'tar-1', '2026-12-02', QUARTA)).rejects.toThrow(/desta semana e o da próxima/)
    expect(tarefas.definirSprint).not.toHaveBeenCalled()
  })

  it('recusa tarefa que não está no sprint e tarefa inexistente', async () => {
    const fora = montar(COMPLETA)
    await expect(new MoverTarefaNoSprint(fora.tarefas, fora.sprints).execute(USER_ID, 'tar-1', '2026-11-19', QUARTA)).rejects.toBeInstanceOf(ConflictError)
    const nada = montar(null)
    await expect(new MoverTarefaNoSprint(nada.tarefas, nada.sprints).execute(USER_ID, 'x', '2026-11-19', QUARTA)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('RemoverTarefaDoSprint', () => {
  it('devolve a tarefa ao backlog mantendo o dia', async () => {
    const { tarefas } = montar(noSprint('2026-11-19'))

    await expect(new RemoverTarefaDoSprint(tarefas).execute(USER_ID, 'tar-1', QUARTA)).resolves.toMatchObject({ sprintId: null, dia: '2026-11-19' })
    expect(tarefas.definirSprint).toHaveBeenCalledWith(USER_ID, 'tar-1', { sprintId: null })
  })

  it('o dia de hoje ainda pode ser removido', async () => {
    const { tarefas } = montar(noSprint('2026-11-18'))
    await expect(new RemoverTarefaDoSprint(tarefas).execute(USER_ID, 'tar-1', QUARTA)).resolves.toMatchObject({ sprintId: null })
  })

  it('recusa tarefa fora do sprint e inexistente', async () => {
    const fora = montar(COMPLETA)
    await expect(new RemoverTarefaDoSprint(fora.tarefas).execute(USER_ID, 'tar-1', QUARTA)).rejects.toBeInstanceOf(ConflictError)
    const nada = montar(null)
    await expect(new RemoverTarefaDoSprint(nada.tarefas).execute(USER_ID, 'x', QUARTA)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('EntrarNoSprintPorConclusao', () => {
  it('concluir num dia útil uma tarefa fora do sprint a puxa para o sprint atual, naquele dia', async () => {
    const { tarefas, sprints } = montar({ ...COMPLETA, dia: '2026-11-10' })

    const resultado = await new EntrarNoSprintPorConclusao(tarefas, sprints).execute(USER_ID, 'tar-1', QUARTA)
    expect(resultado).toMatchObject({ entrou: true, motivo: null, tarefa: { sprintId: 'spr-2026-11-16', dia: '2026-11-18' } })
    expect(tarefas.definirSprint).toHaveBeenCalledWith(USER_ID, 'tar-1', { sprintId: 'spr-2026-11-16', dia: '2026-11-18' })
  })

  it('não puxa no fim de semana', async () => {
    const { tarefas, sprints } = montar(COMPLETA)
    const resultado = await new EntrarNoSprintPorConclusao(tarefas, sprints).execute(USER_ID, 'tar-1', SABADO_00H00)
    expect(resultado.entrou).toBe(false)
    expect(resultado.motivo).toMatch(/Sábado e domingo/)
    expect(tarefas.definirSprint).not.toHaveBeenCalled()
  })

  it('não puxa sem tempo, dificuldade ou prioridade, dizendo o que falta', async () => {
    const { tarefas, sprints } = montar({ ...COMPLETA, dificuldade: null })
    const resultado = await new EntrarNoSprintPorConclusao(tarefas, sprints).execute(USER_ID, 'tar-1', QUARTA)
    expect(resultado).toMatchObject({ entrou: false, motivo: 'Para entrar no sprint, defina antes: dificuldade.' })
  })

  it('não mexe em tarefa que já está em algum sprint nem em arquivada', async () => {
    const dentro = montar(noSprint('2026-11-17'))
    await expect(new EntrarNoSprintPorConclusao(dentro.tarefas, dentro.sprints).execute(USER_ID, 'tar-1', QUARTA)).resolves.toMatchObject({ entrou: false })
    const arquivada = montar({ ...COMPLETA, arquivada: true })
    await expect(new EntrarNoSprintPorConclusao(arquivada.tarefas, arquivada.sprints).execute(USER_ID, 'tar-1', QUARTA)).resolves.toMatchObject({ entrou: false })
    expect(dentro.tarefas.definirSprint).not.toHaveBeenCalled()
    expect(arquivada.tarefas.definirSprint).not.toHaveBeenCalled()
  })

  it('NotFoundError para tarefa inexistente', async () => {
    const { tarefas, sprints } = montar(null)
    await expect(new EntrarNoSprintPorConclusao(tarefas, sprints).execute(USER_ID, 'x', QUARTA)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('entrada automática ao criar e ao editar', () => {
  const areas = () => {
    const a = criarAreaRepositoryFake()
    a.buscarPorId.mockResolvedValue({ id: 'area-1', nome: 'Casa', cor: '#fff', sistema: false, criadoEm: '' })
    return a
  }
  const payload = (extra: Partial<TarefaEdicao> = {}) => ({ ...edicaoDe(COMPLETA, extra), areaId: 'area-1' })

  it('criar com dia válido e pontuação completa já entra no sprint do dia', async () => {
    const { tarefas, sprints } = montar(null)
    tarefas.criar.mockResolvedValue(COMPLETA)

    await new CriarTarefa(tarefas, areas(), sprints).execute(USER_ID, payload({ dia: '2026-11-25' }), QUARTA)
    expect(tarefas.criar).toHaveBeenCalledWith(USER_ID, payload({ dia: '2026-11-25' }), 'spr-2026-11-23')
  })

  it.each([
    ['sem dia', { dia: null }],
    ['com pontuação incompleta', { dia: '2026-11-19', tempoEstimado: null }],
    ['em fim de semana', { dia: '2026-11-21' }],
    ['em dia que já passou', { dia: '2026-11-17' }],
  ] as const)('criar %s apenas cria no backlog', async (_nome, extra) => {
    const { tarefas, sprints } = montar(null)
    tarefas.criar.mockResolvedValue(COMPLETA)

    await new CriarTarefa(tarefas, areas(), sprints).execute(USER_ID, payload(extra), QUARTA)
    expect(tarefas.criar).toHaveBeenCalledWith(USER_ID, payload(extra))
    expect(sprints.garantir).not.toHaveBeenCalled()
  })

  it('editar dando um dia válido a tarefa fora do sprint a coloca nele', async () => {
    const { tarefas, sprints } = montar(COMPLETA)

    await expect(new AtualizarTarefa(tarefas, sprints).execute(USER_ID, 'tar-1', edicaoDe(COMPLETA, { dia: '2026-11-19' }), QUARTA)).resolves.toMatchObject({
      sprintId: 'spr-2026-11-16',
    })
    expect(tarefas.atualizar).toHaveBeenCalledWith(USER_ID, 'tar-1', edicaoDe(COMPLETA, { dia: '2026-11-19' }), 'spr-2026-11-16')
  })

  it('editar com o mesmo dia (removida à mão), arquivada ou incompleta não entra', async () => {
    const removida = montar({ ...COMPLETA, dia: '2026-11-19' })
    await new AtualizarTarefa(removida.tarefas, removida.sprints).execute(USER_ID, 'tar-1', edicaoDe(COMPLETA, { dia: '2026-11-19' }), QUARTA)
    expect(removida.tarefas.atualizar).toHaveBeenCalledWith(USER_ID, 'tar-1', edicaoDe(COMPLETA, { dia: '2026-11-19' }))

    const arquivada = montar({ ...COMPLETA, arquivada: true })
    await new AtualizarTarefa(arquivada.tarefas, arquivada.sprints).execute(USER_ID, 'tar-1', edicaoDe(COMPLETA, { dia: '2026-11-19' }), QUARTA)
    const incompleta = montar(COMPLETA)
    await new AtualizarTarefa(incompleta.tarefas, incompleta.sprints).execute(
      USER_ID,
      'tar-1',
      edicaoDe(COMPLETA, { dia: '2026-11-19', prioridade: null }),
      QUARTA,
    )
    expect(arquivada.sprints.garantir).not.toHaveBeenCalled()
    expect(incompleta.sprints.garantir).not.toHaveBeenCalled()
  })

  it('editar tarefa no sprint: mantém o vínculo na mesma semana e muda de sprint em outra semana', async () => {
    const mesma = montar(noSprint('2026-11-19'))
    await new AtualizarTarefa(mesma.tarefas, mesma.sprints).execute(USER_ID, 'tar-1', edicaoDe(COMPLETA, { dia: '2026-11-20', titulo: 'Novo' }), QUARTA)
    expect(mesma.tarefas.atualizar).toHaveBeenCalledWith(USER_ID, 'tar-1', edicaoDe(COMPLETA, { dia: '2026-11-20', titulo: 'Novo' }))

    const outra = montar(noSprint('2026-11-19'))
    await new AtualizarTarefa(outra.tarefas, outra.sprints).execute(USER_ID, 'tar-1', edicaoDe(COMPLETA, { dia: '2026-11-24' }), QUARTA)
    expect(outra.tarefas.atualizar).toHaveBeenCalledWith(USER_ID, 'tar-1', edicaoDe(COMPLETA, { dia: '2026-11-24' }), 'spr-2026-11-23')
  })

  it('editar tarefa no sprint não pode deixá-la sem dia/pontuação nem em dia passado', async () => {
    const { tarefas, sprints } = montar(noSprint('2026-11-19'))
    const caso = new AtualizarTarefa(tarefas, sprints)

    for (const extra of [{ dia: null }, { dia: '2026-11-21' }, { dia: '2026-11-17' }, { tempoEstimado: null }] as const) {
      const erro = await caso.execute(USER_ID, 'tar-1', edicaoDe(noSprint('2026-11-19'), extra), QUARTA).catch((e) => e)
      expect(erro).toBeInstanceOf(ValidationError)
      expect(erro.message).toMatch(/remova-a do sprint/)
    }
    expect(tarefas.atualizar).not.toHaveBeenCalled()
  })
})

describe('travas por dia: a virada 23:59 → 00:00 em São Paulo', () => {
  const alvo = '2026-11-18' // quarta

  async function tentar(agora: Date) {
    const { tarefas, sprints } = montar(noSprint(alvo))
    const resultados = {
      removerDoSprint: new RemoverTarefaDoSprint(tarefas).execute(USER_ID, 'tar-1', agora),
      mover: new MoverTarefaNoSprint(tarefas, sprints).execute(USER_ID, 'tar-1', '2026-11-20', agora),
      editar: new AtualizarTarefa(tarefas, sprints).execute(USER_ID, 'tar-1', edicaoDe(noSprint(alvo), { titulo: 'Outro' }), agora),
      excluir: new RemoverTarefa(tarefas, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', agora),
      arquivar: new ArquivarTarefa(tarefas).execute(USER_ID, 'tar-1', agora),
    }
    const entradas = await Promise.all(
      Object.entries(resultados).map(async ([chave, promessa]) => [chave, await promessa.then(() => 'ok', (erro: unknown) => erro)] as const),
    )
    return Object.fromEntries(entradas)
  }

  it('às 23:59 de quarta o dia ainda está aberto: remover/mover/editar passam (arquivar pede remover do sprint antes)', async () => {
    const r = await tentar(QUARTA_23H59)
    expect(r.removerDoSprint).toBe('ok')
    expect(r.mover).toBe('ok')
    expect(r.editar).toBe('ok')
    expect(r.excluir).toBe('ok')
    expect(r.arquivar).toBeInstanceOf(ConflictError)
    expect((r.arquivar as Error).message).toMatch(/remova-a do sprint/)
  })

  it('à 00:00 de quinta o dia travou: nada remove, muda de dia, edita, exclui ou arquiva', async () => {
    const r = await tentar(QUINTA_00H00)
    for (const chave of ['removerDoSprint', 'mover', 'editar', 'excluir', 'arquivar']) {
      expect(r[chave]).toBeInstanceOf(ConflictError)
      expect((r[chave] as Error).message).toBe(MENSAGEM_TAREFA_TRAVADA)
    }
  })

  it('travada também recusa mudar de área (só concluir é permitido; a conclusão é da #70)', async () => {
    const tarefas = criarTarefaRepositoryFake()
    const areas = criarAreaRepositoryFake()
    tarefas.buscarPorId.mockResolvedValue(noSprint(alvo))
    areas.buscarPorId.mockResolvedValue({ id: 'area-2', nome: 'x', cor: '#fff', sistema: false, criadoEm: '' })

    await expect(new MoverTarefa(tarefas, areas).execute(USER_ID, 'tar-1', 'area-2', QUINTA_00H00)).rejects.toThrow(MENSAGEM_TAREFA_TRAVADA)
    expect(tarefas.mover).not.toHaveBeenCalled()
  })

  it('tarefa fora do sprint com dia passado continua livre (a trava é do compromisso do sprint)', async () => {
    const tarefas = criarTarefaRepositoryFake()
    tarefas.buscarPorId.mockResolvedValue({ ...COMPLETA, dia: alvo })
    await expect(new RemoverTarefa(tarefas, criarSuperTaskRepositoryFake()).execute(USER_ID, 'tar-1', QUINTA_00H00)).resolves.toBeUndefined()
  })

  it('só o dia que passou trava: o de hoje e os futuros seguem editáveis', async () => {
    const { tarefas } = montar(noSprint('2026-11-19'))
    await expect(new RemoverTarefaDoSprint(tarefas).execute(USER_ID, 'tar-1', QUINTA_00H00)).resolves.toBeDefined()
    const futura = montar(noSprint('2026-11-20'))
    await expect(new MoverTarefaNoSprint(futura.tarefas, futura.sprints).execute(USER_ID, 'tar-1', '2026-11-20', QUINTA_00H00)).resolves.toBeDefined()
  })
})

describe('virada da semana', () => {
  it('sexta 23:59 ainda é o dia útil de sexta; sábado 00:00 o trava e o sprint atual deixa de aceitar adições', async () => {
    const sexta = montar(noSprint('2026-11-20'))
    await expect(new RemoverTarefaDoSprint(sexta.tarefas).execute(USER_ID, 'tar-1', SEXTA_23H59)).resolves.toBeDefined()
    await expect(new RemoverTarefaDoSprint(sexta.tarefas).execute(USER_ID, 'tar-1', SABADO_00H00)).rejects.toThrow(MENSAGEM_TAREFA_TRAVADA)

    const nova = montar(COMPLETA)
    await expect(new AdicionarTarefaAoSprint(nova.tarefas, nova.sprints).execute(USER_ID, 'tar-1', '2026-11-20', SABADO_00H00)).rejects.toThrow(/já passou/)
  })

  it('domingo 23:59 → segunda 00:00: o próximo vira o atual e uma nova semana passa a ser o próximo', async () => {
    const { tarefas, sprints } = montar(COMPLETA)
    const adicionar = new AdicionarTarefaAoSprint(tarefas, sprints)

    // Domingo 23:59: 23–27 é o próximo e 30/11 ainda está fora do alcance.
    await expect(adicionar.execute(USER_ID, 'tar-1', '2026-11-25', DOMINGO_23H59)).resolves.toMatchObject({ sprintId: 'spr-2026-11-23' })
    await expect(adicionar.execute(USER_ID, 'tar-1', '2026-11-30', DOMINGO_23H59)).rejects.toThrow(/desta semana e o da próxima/)

    // Segunda 00:00: 23–27 é o atual (o mesmo sprint) e 30/11 passa a caber.
    await expect(adicionar.execute(USER_ID, 'tar-1', '2026-11-25', SEGUNDA_00H00)).resolves.toMatchObject({ sprintId: 'spr-2026-11-23' })
    await expect(adicionar.execute(USER_ID, 'tar-1', '2026-11-30', SEGUNDA_00H00)).resolves.toMatchObject({ sprintId: 'spr-2026-11-30' })
    // E a semana que acabou deixa de aceitar adições.
    await expect(adicionar.execute(USER_ID, 'tar-1', '2026-11-20', SEGUNDA_00H00)).rejects.toThrow(/já passou/)
  })

  it('tarefas da semana anterior travam na segunda 00:00', async () => {
    const { tarefas } = montar(noSprint('2026-11-20'))
    await expect(new RemoverTarefaDoSprint(tarefas).execute(USER_ID, 'tar-1', DOMINGO_23H59)).rejects.toThrow(MENSAGEM_TAREFA_TRAVADA)
  })
})
