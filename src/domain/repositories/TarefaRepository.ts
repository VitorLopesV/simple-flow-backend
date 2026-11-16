import type { ID } from '../../shared/types/common'
import type { FiltroTarefas, Tarefa, TarefaEdicao, TarefaPayload } from '../entities/Tarefa'

export interface TarefaRepository {
  /** Mais recentes primeiro. */
  listar(userId: ID, filtro: FiltroTarefas): Promise<Tarefa[]>
  buscarPorId(userId: ID, id: ID): Promise<Tarefa | null>
  /** `sprintId` entra na mesma escrita quando a criação já coloca a tarefa no sprint. */
  criar(userId: ID, payload: TarefaPayload, sprintId?: ID): Promise<Tarefa>
  /** `sprintId` omitido = mantém o vínculo atual; `null` tira do sprint. */
  atualizar(userId: ID, id: ID, edicao: TarefaEdicao, sprintId?: ID | null): Promise<Tarefa>
  /** Entra (`sprintId` + `dia`) ou sai (`null`, mantendo o dia) do sprint. */
  definirSprint(userId: ID, id: ID, vinculo: { sprintId: ID | null; dia?: string }): Promise<Tarefa>
  /** Grava `concluida_em`; só preenche se ainda não houver conclusão (ela é definitiva). */
  concluir(userId: ID, id: ID, concluidaEm: string): Promise<Tarefa>
  mover(userId: ID, id: ID, areaId: ID): Promise<Tarefa>
  /** `null` desarquiva. */
  definirArquivamento(userId: ID, id: ID, arquivadaEm: string | null): Promise<Tarefa>
  remover(userId: ID, id: ID): Promise<void>
  /** Filhas de uma Super task (#65), inclusive arquivadas e concluídas. */
  listarDasSuperTasks(userId: ID, superTaskIds: ID[]): Promise<Tarefa[]>
  /** Liga a tarefa a uma Super task; `null` a solta (volta a ser avulsa). */
  definirSuperTask(userId: ID, id: ID, superTaskId: ID | null): Promise<Tarefa>
  /** Move todas as filhas de uma vez (a Super task mudou de área). */
  moverDaSuperTask(userId: ID, superTaskId: ID, areaId: ID): Promise<void>
  /** Todas as filhas viram tarefas avulsas, na mesma área. */
  soltarDaSuperTask(userId: ID, superTaskId: ID): Promise<void>
  /** Exclui todas as filhas (a opção "excluir junto"). */
  removerDaSuperTask(userId: ID, superTaskId: ID): Promise<void>
}
