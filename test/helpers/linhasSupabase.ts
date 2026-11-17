import type { Database } from '../../src/infrastructure/supabase/database.types'

type Tabelas = Database['public']['Tables']

export type AreaRow = Tabelas['areas']['Row']
export type CartaoRow = Tabelas['cartoes']['Row']
export type CategoriaRow = Tabelas['categorias']['Row']
export type EntradaRow = Tabelas['entradas']['Row']
export type FaturaRow = Tabelas['faturas']['Row']
export type AtividadeRow = Tabelas['atividades']['Row']
export type TarefaRow = Tabelas['tarefas']['Row']
export type SuperTaskRow = Tabelas['super_tasks']['Row']
export type ItemRotinaRow = Tabelas['itens_rotina']['Row']
export type SprintRow = Tabelas['sprints']['Row']
export type OcorrenciaRotinaRow = Tabelas['ocorrencias_rotina']['Row']
export type SaidaRow = Tabelas['saidas']['Row']
export type TransacaoRow = Tabelas['transacoes_cartao']['Row']

/** Linhas do banco em snake_case, como o PostgREST devolve — usadas para testar o mapeamento dos repositórios. */
export const USER_ID = 'user-1'

export function linhaEntrada(sobrescritas: Partial<EntradaRow> = {}): EntradaRow {
  return {
    id: 'ent-1',
    descricao: 'Salário',
    valor: 5000,
    data: '2026-08-05',
    categoria_id: 'cat-renda',
    tipo: 'SALARIO',
    recorrente: false,
    observacao: null,
    serie_id: null,
    serie_encerrada: false,
    editado_manualmente: false,
    user_id: USER_ID,
    criado_em: '2026-08-01T00:00:00.000Z',
    atualizado_em: '2026-08-02T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaSaida(sobrescritas: Partial<SaidaRow> = {}): SaidaRow {
  return {
    id: 'sai-1',
    descricao: 'Aluguel',
    valor: 1000,
    data: '2026-08-05',
    categoria_id: 'cat-fixa',
    tipo: 'CONTA',
    status: 'PAGO',
    vencimento: null,
    pago_em: '2026-08-05',
    forma_pagamento: 'PIX',
    cartao_id: null,
    recorrente: false,
    observacao: null,
    automatica: false,
    serie_id: null,
    serie_encerrada: false,
    editado_manualmente: false,
    user_id: USER_ID,
    criado_em: '2026-08-01T00:00:00.000Z',
    atualizado_em: '2026-08-02T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaCartao(sobrescritas: Partial<CartaoRow> = {}): CartaoRow {
  return {
    id: 'cartao-1',
    nome: 'Nubank',
    bandeira: 'MASTERCARD',
    ultimos_digitos: '1234',
    limite: 5000,
    dia_fechamento: 10,
    dia_vencimento: 20,
    cor: '#820ad1',
    ativo: true,
    user_id: USER_ID,
    criado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaFatura(sobrescritas: Partial<FaturaRow> = {}): FaturaRow {
  return {
    id: 'fat-1',
    cartao_id: 'cartao-1',
    competencia: '2026-07',
    fechamento: '2026-07-31',
    vencimento: '2026-08-10',
    total: 450,
    status: 'ABERTA',
    pago_em: null,
    user_id: USER_ID,
    ...sobrescritas,
  }
}

export function linhaTransacao(sobrescritas: Partial<TransacaoRow> = {}): TransacaoRow {
  return {
    id: 'tr-1',
    cartao_id: 'cartao-1',
    fatura_id: 'fat-1',
    descricao: 'Mercado',
    valor: 200,
    data: '2026-08-15',
    categoria_id: 'cat-var',
    tipo: 'ALIMENTACAO',
    parcela_atual: 1,
    total_parcelas: 1,
    recorrente: false,
    observacao: null,
    serie_id: null,
    serie_encerrada: false,
    editado_manualmente: false,
    user_id: USER_ID,
    criado_em: '2026-08-15T12:00:00.000Z',
    atualizado_em: '2026-08-15T12:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaAtividade(sobrescritas: Partial<AtividadeRow> = {}): AtividadeRow {
  return {
    id: 'atv-1',
    user_id: USER_ID,
    tipo: 'SAIDA',
    acao: 'ADICIONADO',
    registro_id: 'reg-1',
    descricao: 'Aluguel',
    valor: 100,
    data: '2026-08-05',
    categoria_id: 'cat-fixa',
    criado_em: '2026-08-05T12:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaArea(sobrescritas: Partial<AreaRow> = {}): AreaRow {
  return {
    id: 'area-1',
    nome: 'Estudos',
    cor: '#10b981',
    sistema: false,
    user_id: USER_ID,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaItemRotina(sobrescritas: Partial<ItemRotinaRow> = {}): ItemRotinaRow {
  return {
    id: 'rot-1',
    user_id: USER_ID,
    area_id: 'area-rotina',
    nome: 'Tomar remédio',
    modo: 'DIAS_DA_SEMANA',
    dias_semana: [1, 3, 5],
    intervalo_dias: null,
    data_inicial: null,
    vezes: [{ hora: '08:00' }, { hora: null }],
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaTarefa(sobrescritas: Partial<TarefaRow> = {}): TarefaRow {
  return {
    id: 'tar-1',
    user_id: USER_ID,
    area_id: 'area-1',
    titulo: 'Pintar a casa',
    dia: null,
    hora: null,
    tempo_estimado_minutos: null,
    dificuldade: null,
    prioridade: null,
    notas: null,
    sprint_id: null,
    super_task_id: null,
    nao_concluida_no_sprint_de: null,
    arquivada_em: null,
    concluida_em: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaSuperTask(sobrescritas: Partial<SuperTaskRow> = {}): SuperTaskRow {
  return {
    id: 'st-1',
    user_id: USER_ID,
    area_id: 'area-1',
    titulo: 'Pintar a casa',
    notas: null,
    data_termino: null,
    concluida_em: null,
    arquivada_em: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaSprint(sobrescritas: Partial<SprintRow> = {}): SprintRow {
  return {
    id: 'spr-1',
    user_id: USER_ID,
    inicio: '2026-11-16',
    fim: '2026-11-20',
    situacao: 'ABERTO',
    rotina_gerada_em: null,
    fechado_em: null,
    foto: null,
    fechamento_aplicado_em: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function linhaOcorrenciaRotina(sobrescritas: Partial<OcorrenciaRotinaRow> = {}): OcorrenciaRotinaRow {
  return {
    id: 'oco-1',
    user_id: USER_ID,
    sprint_id: 'spr-1',
    item_id: 'rot-1',
    nome: 'Tomar remédio',
    data: '2026-11-16',
    hora: '08:00',
    indice: 0,
    ordem: 0,
    lembrete: false,
    concluida_em: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}
