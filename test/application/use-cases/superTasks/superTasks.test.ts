import { beforeEach, describe, expect, it } from 'vitest'

import { AdicionarTarefaASuperTask } from '../../../../src/application/use-cases/superTasks/AdicionarTarefaASuperTask'
import { ArquivarSuperTask } from '../../../../src/application/use-cases/superTasks/ArquivarSuperTask'
import { AtualizarSuperTask } from '../../../../src/application/use-cases/superTasks/AtualizarSuperTask'
import { ConcluirSuperTaskSeCompleta } from '../../../../src/application/use-cases/superTasks/ConcluirSuperTaskSeCompleta'
import { ConverterTarefaEmSuperTask } from '../../../../src/application/use-cases/superTasks/ConverterTarefaEmSuperTask'
import { CriarSuperTask } from '../../../../src/application/use-cases/superTasks/CriarSuperTask'
import { DesmarcarSuperTaskConcluida } from '../../../../src/application/use-cases/superTasks/DesmarcarSuperTaskConcluida'
import { ListarSuperTasks } from '../../../../src/application/use-cases/superTasks/ListarSuperTasks'
import { MarcarSuperTaskConcluida } from '../../../../src/application/use-cases/superTasks/MarcarSuperTaskConcluida'
import { MoverSuperTask } from '../../../../src/application/use-cases/superTasks/MoverSuperTask'
import { ObterSuperTask } from '../../../../src/application/use-cases/superTasks/ObterSuperTask'
import { RemoverSuperTask } from '../../../../src/application/use-cases/superTasks/RemoverSuperTask'
import { RetirarTarefaDaSuperTask } from '../../../../src/application/use-cases/superTasks/RetirarTarefaDaSuperTask'
import type { Area } from '../../../../src/domain/entities/Area'
import type { SuperTask } from '../../../../src/domain/entities/SuperTask'
import type { Tarefa } from '../../../../src/domain/entities/Tarefa'
import { ConflictError, NotFoundError, ValidationError } from '../../../../src/domain/errors/DomainError'
import {
  criarAreaRepositoryFake,
  criarSuperTaskRepositoryFake,
  criarTarefaRepositoryFake,
} from '../../../helpers/repositoriosFake'

const USER_ID = 'user-1'
// Quarta 2026-11-18 12:00 em São Paulo.
const AGORA = new Date('2026-11-18T15:00:00.000Z')

const AREA: Area = { id: 'area-1', nome: 'Casa', cor: '#fff', sistema: false, criadoEm: '2026-01-01T00:00:00.000Z' }
const ROTINA: Area = { ...AREA, id: 'area-rotina', nome: 'Rotina', sistema: true }

const SUPER: SuperTask = {
  id: 'st-1',
  areaId: 'area-1',
  titulo: 'Pintar a casa',
  notas: null,
  dataTermino: null,
  concluidaEm: null,
  concluida: false,
  arquivada: false,
  arquivadaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}
const SUPER_CONCLUIDA: SuperTask = { ...SUPER, concluida: true, concluidaEm: '2026-11-17T12:00:00.000Z' }

const TAREFA: Tarefa = {
  id: 'tar-1',
  areaId: 'area-1',
  titulo: 'Comprar tinta',
  dia: null,
  hora: null,
  tempoEstimado: null,
  dificuldade: null,
  prioridade: null,
  notas: 'branca',
  sprintId: null,
  superTaskId: null,
  concluidaEm: null,
  concluida: false,
  atrasada: false,
  arquivada: false,
  arquivadaEm: null,
  criadoEm: '2026-01-01T00:00:00.000Z',
}
const FILHA: Tarefa = { ...TAREFA, id: 'fil-1', superTaskId: 'st-1' }
const FILHA_CONCLUIDA: Tarefa = { ...FILHA, id: 'fil-2', concluida: true, concluidaEm: '2026-11-17T12:00:00.000Z' }

function montar() {
  return { superTasks: criarSuperTaskRepositoryFake(), tarefas: criarTarefaRepositoryFake(), areas: criarAreaRepositoryFake() }
}

let r: ReturnType<typeof montar>
beforeEach(() => {
  r = montar()
  r.superTasks.buscarPorId.mockResolvedValue(SUPER)
  r.tarefas.listarDasSuperTasks.mockResolvedValue([])
  r.areas.buscarPorId.mockResolvedValue(AREA)
})

describe('CriarSuperTask', () => {
  const payload = { areaId: 'area-1', titulo: 'TCC', notas: null, dataTermino: '2026-12-20' }

  it('cria na área e devolve a leitura sem filhas (0%, não iniciada)', async () => {
    r.superTasks.criar.mockResolvedValue({ ...SUPER, titulo: 'TCC', dataTermino: '2026-12-20' })

    const resultado = await new CriarSuperTask(r.superTasks, r.areas).execute(USER_ID, payload, AGORA)

    expect(r.superTasks.criar).toHaveBeenCalledWith(USER_ID, payload)
    expect(resultado).toMatchObject({ filhas: [], progresso: 0, estado: 'NAO_INICIADA', vencida: false })
  })

  it('recusa área inexistente (404) e a Rotina (422)', async () => {
    r.areas.buscarPorId.mockResolvedValueOnce(null)
    await expect(new CriarSuperTask(r.superTasks, r.areas).execute(USER_ID, payload)).rejects.toBeInstanceOf(NotFoundError)

    r.areas.buscarPorId.mockResolvedValueOnce(ROTINA)
    await expect(new CriarSuperTask(r.superTasks, r.areas).execute(USER_ID, payload)).rejects.toBeInstanceOf(ValidationError)
    expect(r.superTasks.criar).not.toHaveBeenCalled()
  })
})

describe('ConverterTarefaEmSuperTask', () => {
  const converter = () => new ConverterTarefaEmSuperTask(r.tarefas, r.superTasks)

  it('copia título, área e notas, apaga a tarefa e devolve a Super task', async () => {
    r.tarefas.buscarPorId.mockResolvedValue(TAREFA)
    r.superTasks.criar.mockResolvedValue(SUPER)
    r.tarefas.remover.mockResolvedValue(undefined)

    const resultado = await converter().execute(USER_ID, 'tar-1', '2026-12-01', AGORA)

    expect(r.superTasks.criar).toHaveBeenCalledWith(USER_ID, {
      areaId: 'area-1',
      titulo: 'Comprar tinta',
      notas: 'branca',
      dataTermino: '2026-12-01',
    })
    expect(r.tarefas.remover).toHaveBeenCalledWith(USER_ID, 'tar-1')
    expect(resultado.id).toBe('st-1')
  })

  it('desfaz a Super task se a tarefa não puder ser apagada', async () => {
    r.tarefas.buscarPorId.mockResolvedValue(TAREFA)
    r.superTasks.criar.mockResolvedValue(SUPER)
    r.tarefas.remover.mockRejectedValue(new Error('falha'))
    r.superTasks.remover.mockResolvedValue(undefined)

    await expect(converter().execute(USER_ID, 'tar-1', null)).rejects.toThrow('falha')
    expect(r.superTasks.remover).toHaveBeenCalledWith(USER_ID, 'st-1')
  })

  it('mantém o erro original mesmo se o desfazer também falhar', async () => {
    r.tarefas.buscarPorId.mockResolvedValue(TAREFA)
    r.superTasks.criar.mockResolvedValue(SUPER)
    r.tarefas.remover.mockRejectedValue(new Error('falha'))
    r.superTasks.remover.mockRejectedValue(new Error('outra'))

    await expect(converter().execute(USER_ID, 'tar-1', null)).rejects.toThrow('falha')
  })

  it.each([
    ['inexistente', null, NotFoundError],
    ['concluída', { ...TAREFA, concluida: true }, ConflictError],
    ['no sprint', { ...TAREFA, sprintId: 'spr-1' }, ConflictError],
    ['já filha de outra Super task', { ...TAREFA, superTaskId: 'st-9' }, ConflictError],
    ['arquivada', { ...TAREFA, arquivada: true }, ValidationError],
  ])('recusa tarefa %s sem gravar nada', async (_nome, tarefa, erro) => {
    r.tarefas.buscarPorId.mockResolvedValue(tarefa)

    await expect(converter().execute(USER_ID, 'tar-1', null)).rejects.toBeInstanceOf(erro)
    expect(r.superTasks.criar).not.toHaveBeenCalled()
    expect(r.tarefas.remover).not.toHaveBeenCalled()
  })
})

describe('ListarSuperTasks / ObterSuperTask', () => {
  it('lista com filhas, % e estado derivados, repassando o filtro', async () => {
    const outra = { ...SUPER, id: 'st-2' }
    r.superTasks.listar.mockResolvedValue([SUPER, outra])
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA, { ...FILHA_CONCLUIDA, superTaskId: 'st-1' }])

    const lista = await new ListarSuperTasks(r.superTasks, r.tarefas).execute(USER_ID, { areaId: 'area-1', incluirArquivadas: false }, AGORA)

    expect(r.superTasks.listar).toHaveBeenCalledWith(USER_ID, { areaId: 'area-1', incluirArquivadas: false })
    expect(r.tarefas.listarDasSuperTasks).toHaveBeenCalledWith(USER_ID, ['st-1', 'st-2'])
    expect(lista[0]).toMatchObject({ totalFilhas: 2, filhasConcluidas: 1, progresso: 50, estado: 'EM_ANDAMENTO' })
    expect(lista[1]).toMatchObject({ totalFilhas: 0, progresso: 0, estado: 'NAO_INICIADA' })
  })

  it('obtém uma Super task com as filhas e indica a vencida', async () => {
    r.superTasks.buscarPorId.mockResolvedValue({ ...SUPER, dataTermino: '2026-11-10' })
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA])

    const resultado = await new ObterSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', AGORA)

    expect(resultado.filhas).toEqual([FILHA])
    expect(resultado.vencida).toBe(true)
  })

  it('404 para Super task inexistente', async () => {
    r.superTasks.buscarPorId.mockResolvedValue(null)
    await expect(new ObterSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('AtualizarSuperTask', () => {
  const edicao = { titulo: 'Novo', notas: 'n', dataTermino: null }

  it('edita os campos', async () => {
    r.superTasks.atualizar.mockResolvedValue({ ...SUPER, titulo: 'Novo' })

    const resultado = await new AtualizarSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', edicao, AGORA)

    expect(r.superTasks.atualizar).toHaveBeenCalledWith(USER_ID, 'st-1', edicao)
    expect(resultado.titulo).toBe('Novo')
  })

  it('concluída está travada: 409 sem gravar', async () => {
    r.superTasks.buscarPorId.mockResolvedValue(SUPER_CONCLUIDA)
    await expect(new AtualizarSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', edicao)).rejects.toBeInstanceOf(ConflictError)
    expect(r.superTasks.atualizar).not.toHaveBeenCalled()
  })

  it('404 para inexistente', async () => {
    r.superTasks.buscarPorId.mockResolvedValue(null)
    await expect(new AtualizarSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'x', edicao)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('MoverSuperTask', () => {
  const mover = () => new MoverSuperTask(r.superTasks, r.tarefas, r.areas)
  const destino = { ...AREA, id: 'area-2' }

  it('move a Super task e as filhas para a nova área', async () => {
    r.areas.buscarPorId.mockResolvedValue(destino)
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA])
    r.superTasks.mover.mockResolvedValue({ ...SUPER, areaId: 'area-2' })

    const resultado = await mover().execute(USER_ID, 'st-1', 'area-2', AGORA)

    expect(r.superTasks.mover).toHaveBeenCalledWith(USER_ID, 'st-1', 'area-2')
    expect(r.tarefas.moverDaSuperTask).toHaveBeenCalledWith(USER_ID, 'st-1', 'area-2')
    expect(resultado.areaId).toBe('area-2')
    expect(resultado.filhas[0]!.areaId).toBe('area-2')
  })

  it('sem filhas, só move a Super task', async () => {
    r.areas.buscarPorId.mockResolvedValue(destino)
    r.superTasks.mover.mockResolvedValue({ ...SUPER, areaId: 'area-2' })

    await mover().execute(USER_ID, 'st-1', 'area-2', AGORA)

    expect(r.tarefas.moverDaSuperTask).not.toHaveBeenCalled()
  })

  it('mesma área: devolve como está, sem gravar', async () => {
    await mover().execute(USER_ID, 'st-1', 'area-1', AGORA)
    expect(r.superTasks.mover).not.toHaveBeenCalled()
  })

  it('recusa Super task concluída (409), destino inexistente (404) e a Rotina (422)', async () => {
    r.superTasks.buscarPorId.mockResolvedValueOnce(SUPER_CONCLUIDA)
    await expect(mover().execute(USER_ID, 'st-1', 'area-2')).rejects.toBeInstanceOf(ConflictError)

    r.superTasks.buscarPorId.mockResolvedValueOnce(null)
    await expect(mover().execute(USER_ID, 'x', 'area-2')).rejects.toBeInstanceOf(NotFoundError)

    r.areas.buscarPorId.mockResolvedValueOnce(null)
    await expect(mover().execute(USER_ID, 'st-1', 'area-2')).rejects.toBeInstanceOf(NotFoundError)

    r.areas.buscarPorId.mockResolvedValueOnce(ROTINA)
    await expect(mover().execute(USER_ID, 'st-1', 'area-rotina')).rejects.toBeInstanceOf(ValidationError)
    expect(r.superTasks.mover).not.toHaveBeenCalled()
  })

  it('filha concluída não muda de área: o grupo todo fica onde está (409, sem escrita)', async () => {
    r.areas.buscarPorId.mockResolvedValue(destino)
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA, FILHA_CONCLUIDA])

    await expect(mover().execute(USER_ID, 'st-1', 'area-2', AGORA)).rejects.toThrow(/filhas concluídas/)
    expect(r.superTasks.mover).not.toHaveBeenCalled()
    expect(r.tarefas.moverDaSuperTask).not.toHaveBeenCalled()
  })

  it('filha travada pelo sprint (dia que já passou) também impede mover', async () => {
    r.areas.buscarPorId.mockResolvedValue(destino)
    r.tarefas.listarDasSuperTasks.mockResolvedValue([{ ...FILHA, sprintId: 'spr-1', dia: '2026-11-17' }])

    await expect(mover().execute(USER_ID, 'st-1', 'area-2', AGORA)).rejects.toBeInstanceOf(ConflictError)
    expect(r.superTasks.mover).not.toHaveBeenCalled()
  })
})

describe('AdicionarTarefaASuperTask', () => {
  const adicionar = () => new AdicionarTarefaASuperTask(r.superTasks, r.tarefas)

  it('liga a tarefa avulsa e devolve a leitura atualizada', async () => {
    r.tarefas.buscarPorId.mockResolvedValue(TAREFA)
    r.tarefas.definirSuperTask.mockResolvedValue(FILHA)
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA])

    const resultado = await adicionar().execute(USER_ID, 'st-1', 'tar-1', AGORA)

    expect(r.tarefas.definirSuperTask).toHaveBeenCalledWith(USER_ID, 'tar-1', 'st-1')
    expect(resultado).toMatchObject({ totalFilhas: 1, progresso: 0, estado: 'NAO_INICIADA' })
  })

  it('já é filha desta Super task: não grava de novo', async () => {
    r.tarefas.buscarPorId.mockResolvedValue(FILHA)
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA])

    await adicionar().execute(USER_ID, 'st-1', 'fil-1', AGORA)

    expect(r.tarefas.definirSuperTask).not.toHaveBeenCalled()
  })

  it.each([
    ['Super task inexistente', null, TAREFA, NotFoundError],
    ['Super task concluída (não aceita filhas novas)', SUPER_CONCLUIDA, TAREFA, ConflictError],
    ['tarefa inexistente', SUPER, null, NotFoundError],
    ['tarefa concluída', SUPER, { ...TAREFA, concluida: true }, ConflictError],
    ['tarefa filha de outra Super task', SUPER, { ...TAREFA, superTaskId: 'st-9' }, ConflictError],
    ['tarefa arquivada', SUPER, { ...TAREFA, arquivada: true }, ValidationError],
    ['tarefa de outra área', SUPER, { ...TAREFA, areaId: 'area-2' }, ValidationError],
  ])('recusa: %s', async (_nome, superTask, tarefa, erro) => {
    r.superTasks.buscarPorId.mockResolvedValue(superTask)
    r.tarefas.buscarPorId.mockResolvedValue(tarefa)

    await expect(adicionar().execute(USER_ID, 'st-1', 'tar-1')).rejects.toBeInstanceOf(erro)
    expect(r.tarefas.definirSuperTask).not.toHaveBeenCalled()
  })
})

describe('RetirarTarefaDaSuperTask', () => {
  const retirar = () => new RetirarTarefaDaSuperTask(r.superTasks, r.tarefas)

  it('solta a tarefa e devolve a leitura', async () => {
    r.tarefas.buscarPorId.mockResolvedValue(FILHA)
    r.tarefas.definirSuperTask.mockResolvedValue(TAREFA)
    r.tarefas.listarDasSuperTasks.mockResolvedValue([{ ...FILHA_CONCLUIDA, id: 'fil-9' }, { ...FILHA, id: 'fil-8' }])

    await retirar().execute(USER_ID, 'st-1', 'fil-1', AGORA)

    expect(r.tarefas.definirSuperTask).toHaveBeenCalledWith(USER_ID, 'fil-1', null)
    expect(r.superTasks.definirConclusao).not.toHaveBeenCalled()
  })

  it('se a retirada deixa só filhas concluídas, a Super task se conclui', async () => {
    r.tarefas.buscarPorId.mockResolvedValue(FILHA)
    r.tarefas.definirSuperTask.mockResolvedValue(TAREFA)
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA_CONCLUIDA])
    r.superTasks.definirConclusao.mockResolvedValue(SUPER_CONCLUIDA)

    await retirar().execute(USER_ID, 'st-1', 'fil-1', AGORA)

    expect(r.superTasks.definirConclusao).toHaveBeenCalledWith(USER_ID, 'st-1', AGORA.toISOString())
  })

  it('filha concluída não sai da Super task (conflito com a #70): 409 explícito', async () => {
    r.tarefas.buscarPorId.mockResolvedValue(FILHA_CONCLUIDA)

    await expect(retirar().execute(USER_ID, 'st-1', 'fil-2')).rejects.toThrow(/filha concluída não pode ser retirada/)
    expect(r.tarefas.definirSuperTask).not.toHaveBeenCalled()
  })

  it('recusa Super task concluída (409) e tarefa que não é filha dela (404)', async () => {
    r.superTasks.buscarPorId.mockResolvedValueOnce(SUPER_CONCLUIDA)
    await expect(retirar().execute(USER_ID, 'st-1', 'fil-1')).rejects.toBeInstanceOf(ConflictError)

    r.superTasks.buscarPorId.mockResolvedValueOnce(null)
    await expect(retirar().execute(USER_ID, 'x', 'fil-1')).rejects.toBeInstanceOf(NotFoundError)

    r.tarefas.buscarPorId.mockResolvedValueOnce(TAREFA)
    await expect(retirar().execute(USER_ID, 'st-1', 'tar-1')).rejects.toBeInstanceOf(NotFoundError)

    r.tarefas.buscarPorId.mockResolvedValueOnce(null)
    await expect(retirar().execute(USER_ID, 'st-1', 'x')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('ConcluirSuperTaskSeCompleta', () => {
  const concluir = () => new ConcluirSuperTaskSeCompleta(r.superTasks, r.tarefas)

  it('conclui quando todas as filhas estão concluídas', async () => {
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA_CONCLUIDA])
    r.superTasks.definirConclusao.mockResolvedValue(SUPER_CONCLUIDA)

    await expect(concluir().execute(USER_ID, 'st-1', AGORA)).resolves.toBe(SUPER_CONCLUIDA)
    expect(r.superTasks.definirConclusao).toHaveBeenCalledWith(USER_ID, 'st-1', AGORA.toISOString())
  })

  it.each([
    ['ainda faltam filhas', [FILHA_CONCLUIDA, FILHA]],
    ['não há filhas', []],
  ])('não conclui quando %s', async (_nome, filhas) => {
    r.tarefas.listarDasSuperTasks.mockResolvedValue(filhas)

    await concluir().execute(USER_ID, 'st-1', AGORA)

    expect(r.superTasks.definirConclusao).not.toHaveBeenCalled()
  })

  it('já concluída, inexistente ou tarefa avulsa (sem Super task): não faz nada', async () => {
    r.superTasks.buscarPorId.mockResolvedValueOnce(SUPER_CONCLUIDA)
    await expect(concluir().execute(USER_ID, 'st-1')).resolves.toBe(SUPER_CONCLUIDA)

    r.superTasks.buscarPorId.mockResolvedValueOnce(null)
    await expect(concluir().execute(USER_ID, 'x')).resolves.toBeNull()

    await expect(concluir().execute(USER_ID, null)).resolves.toBeNull()
    expect(r.superTasks.definirConclusao).not.toHaveBeenCalled()
  })
})

describe('MarcarSuperTaskConcluida / DesmarcarSuperTaskConcluida', () => {
  it('marcar com 100%: grava a conclusão', async () => {
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA_CONCLUIDA])
    r.superTasks.definirConclusao.mockResolvedValue(SUPER_CONCLUIDA)

    const resultado = await new MarcarSuperTaskConcluida(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', AGORA)

    expect(r.superTasks.definirConclusao).toHaveBeenCalledWith(USER_ID, 'st-1', AGORA.toISOString())
    expect(resultado.estado).toBe('CONCLUIDA')
  })

  it.each([
    ['filhas incompletas', [FILHA_CONCLUIDA, FILHA]],
    ['sem filhas', []],
  ])('nunca marca abaixo de 100%%: %s → 422', async (_nome, filhas) => {
    r.tarefas.listarDasSuperTasks.mockResolvedValue(filhas)

    await expect(new MarcarSuperTaskConcluida(r.superTasks, r.tarefas).execute(USER_ID, 'st-1')).rejects.toBeInstanceOf(ValidationError)
    expect(r.superTasks.definirConclusao).not.toHaveBeenCalled()
  })

  it('marcar é idempotente e 404 para inexistente', async () => {
    r.superTasks.buscarPorId.mockResolvedValueOnce(SUPER_CONCLUIDA)
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA_CONCLUIDA])
    await new MarcarSuperTaskConcluida(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', AGORA)
    expect(r.superTasks.definirConclusao).not.toHaveBeenCalled()

    r.superTasks.buscarPorId.mockResolvedValueOnce(null)
    await expect(new MarcarSuperTaskConcluida(r.superTasks, r.tarefas).execute(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('desmarcar reabre e mantém as filhas concluídas; reaberta em 100% pode ser marcada de novo', async () => {
    r.superTasks.buscarPorId.mockResolvedValue(SUPER_CONCLUIDA)
    r.superTasks.definirConclusao.mockResolvedValue(SUPER)
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA_CONCLUIDA])

    const resultado = await new DesmarcarSuperTaskConcluida(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', AGORA)

    expect(r.superTasks.definirConclusao).toHaveBeenCalledWith(USER_ID, 'st-1', null)
    expect(resultado).toMatchObject({ concluida: false, progresso: 100, estado: 'EM_ANDAMENTO', podeConcluir: true })
    expect(resultado.filhas[0]!.concluida).toBe(true)
  })

  it('desmarcar é idempotente e 404 para inexistente', async () => {
    await new DesmarcarSuperTaskConcluida(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', AGORA)
    expect(r.superTasks.definirConclusao).not.toHaveBeenCalled()

    r.superTasks.buscarPorId.mockResolvedValueOnce(null)
    await expect(new DesmarcarSuperTaskConcluida(r.superTasks, r.tarefas).execute(USER_ID, 'x')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('ArquivarSuperTask', () => {
  it('arquiva (inclusive a concluída) e desarquiva', async () => {
    r.superTasks.buscarPorId.mockResolvedValue(SUPER_CONCLUIDA)
    r.superTasks.definirArquivamento.mockResolvedValue({ ...SUPER_CONCLUIDA, arquivada: true })

    const arquivada = await new ArquivarSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', true, AGORA)
    expect(r.superTasks.definirArquivamento).toHaveBeenCalledWith(USER_ID, 'st-1', AGORA.toISOString())
    expect(arquivada.arquivada).toBe(true)

    r.superTasks.buscarPorId.mockResolvedValue({ ...SUPER, arquivada: true })
    r.superTasks.definirArquivamento.mockResolvedValue(SUPER)
    await new ArquivarSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', false, AGORA)
    expect(r.superTasks.definirArquivamento).toHaveBeenLastCalledWith(USER_ID, 'st-1', null)
  })

  it('é idempotente e 404 para inexistente', async () => {
    await new ArquivarSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', false, AGORA)
    expect(r.superTasks.definirArquivamento).not.toHaveBeenCalled()

    r.superTasks.buscarPorId.mockResolvedValue(null)
    await expect(new ArquivarSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'x', true)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('RemoverSuperTask', () => {
  const remover = (destino: 'SOLTAR' | 'EXCLUIR') => new RemoverSuperTask(r.superTasks, r.tarefas).execute(USER_ID, 'st-1', destino, AGORA)

  it('SOLTAR: as filhas viram avulsas e a Super task some', async () => {
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA, FILHA_CONCLUIDA])

    await remover('SOLTAR')

    expect(r.tarefas.soltarDaSuperTask).toHaveBeenCalledWith(USER_ID, 'st-1')
    expect(r.tarefas.removerDaSuperTask).not.toHaveBeenCalled()
    expect(r.superTasks.remover).toHaveBeenCalledWith(USER_ID, 'st-1')
  })

  it('EXCLUIR: as filhas saem junto', async () => {
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA])

    await remover('EXCLUIR')

    expect(r.tarefas.removerDaSuperTask).toHaveBeenCalledWith(USER_ID, 'st-1')
    expect(r.tarefas.soltarDaSuperTask).not.toHaveBeenCalled()
    expect(r.superTasks.remover).toHaveBeenCalledWith(USER_ID, 'st-1')
  })

  it.each(['SOLTAR', 'EXCLUIR'] as const)('%s: bloqueada se uma filha está no sprint aberto, sem escrever', async (destino) => {
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA, { ...FILHA, id: 'fil-3', sprintId: 'spr-1', dia: '2026-11-19' }])

    await expect(remover(destino)).rejects.toThrow(/sprint aberto/)
    expect(r.tarefas.soltarDaSuperTask).not.toHaveBeenCalled()
    expect(r.tarefas.removerDaSuperTask).not.toHaveBeenCalled()
    expect(r.superTasks.remover).not.toHaveBeenCalled()
  })

  it('filha concluída que ficou no sprint (histórico) não bloqueia o SOLTAR', async () => {
    r.tarefas.listarDasSuperTasks.mockResolvedValue([{ ...FILHA_CONCLUIDA, sprintId: 'spr-1', dia: '2026-11-17' }])

    await remover('SOLTAR')

    expect(r.superTasks.remover).toHaveBeenCalled()
  })

  it('EXCLUIR é recusado com filha concluída (a conclusão é definitiva): use SOLTAR', async () => {
    r.tarefas.listarDasSuperTasks.mockResolvedValue([FILHA, FILHA_CONCLUIDA])

    await expect(remover('EXCLUIR')).rejects.toThrow(/solte as filhas/)
    expect(r.tarefas.removerDaSuperTask).not.toHaveBeenCalled()
  })

  it('404 para Super task inexistente', async () => {
    r.superTasks.buscarPorId.mockResolvedValue(null)
    await expect(remover('SOLTAR')).rejects.toBeInstanceOf(NotFoundError)
  })
})
