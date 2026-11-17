import type { Request } from 'express'

import { FecharSprintsVencidos } from '../../../application/use-cases/sprints/FecharSprintsVencidos'
import { SupabaseOcorrenciaRotinaRepository } from '../../../infrastructure/supabase/repositories/SupabaseOcorrenciaRotinaRepository'
import { SupabaseRecompensaPadraoRepository } from '../../../infrastructure/supabase/repositories/SupabaseRecompensaPadraoRepository'
import { SupabaseSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseSprintRepository'
import { SupabaseTarefasDoSprintRepository } from '../../../infrastructure/supabase/repositories/SupabaseTarefasDoSprintRepository'

/** Reserva do job de fechamento (#71): fecha antes o sprint vencido do usuário, se o cron ainda não rodou. */
export function reservaDeFechamento(req: Request) {
  return new FecharSprintsVencidos(
    new SupabaseSprintRepository(req.supabase!),
    new SupabaseOcorrenciaRotinaRepository(req.supabase!),
    new SupabaseTarefasDoSprintRepository(req.supabase!),
    new SupabaseRecompensaPadraoRepository(req.supabase!),
  )
}
