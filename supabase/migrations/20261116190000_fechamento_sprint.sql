-- Fechamento automático e idempotente do sprint (issue #71).
-- O sprint fecha na sexta 23:59 em America/Sao_Paulo (= sábado 02:59 UTC). Segue o padrão do job
-- `gerar-recorrencias-mes-seguinte`: função SQL + pg_cron. Reserva: se o job falhar, o backend fecha o sprint
-- vencido no primeiro acesso do usuário (`FecharSprintsVencidos`), com a mesma regra em TypeScript.

-- ------------------------------------------------------------------------------
-- 1) Colunas
-- ------------------------------------------------------------------------------
-- `foto`: placar congelado no fechamento, no mesmo formato JSON do placar da API (total, feitos, percentual,
-- bonus, rotina{...}, tarefas{...}). Nula enquanto o sprint está ABERTO; depois de gravada nunca muda.
-- `fechamento_aplicado_em`: o fechamento terminou (tarefas devolvidas e próximo sprint criado). Se uma execução
-- cair no meio, ele fica nulo e a seguinte retoma de onde parou, sem regravar a foto.
alter table public.sprints
  add column if not exists fechado_em timestamptz,
  add column if not exists foto jsonb,
  add column if not exists fechamento_aplicado_em timestamptz;

-- Marca de histórico lida pelo front: segunda-feira (`inicio`) do sprint em que a tarefa ficou sem concluir
-- e foi devolvida à área ("não concluída no sprint de DD/MM"). Não é limpa ao replanejar.
alter table public.tarefas
  add column if not exists nao_concluida_no_sprint_de date;

-- ------------------------------------------------------------------------------
-- 2) Sprint fechado é imutável
-- ------------------------------------------------------------------------------
-- Barra qualquer alteração de situação, foto ou instante de um sprint já FECHADO (nenhuma rota, nem o job).
-- `fechamento_aplicado_em` continua gravável: é o único campo que o fechamento ainda preenche depois.
create or replace function public.sprints_foto_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.situacao = 'FECHADO'
     and (new.situacao, new.foto, new.fechado_em) is distinct from (old.situacao, old.foto, old.fechado_em) then
    raise exception 'Sprint fechado é imutável.';
  end if;
  return new;
end;
$$;

revoke execute on function public.sprints_foto_imutavel() from public, anon, authenticated;

drop trigger if exists sprints_foto_imutavel on public.sprints;
create trigger sprints_foto_imutavel
  before update on public.sprints
  for each row execute function public.sprints_foto_imutavel();

-- ------------------------------------------------------------------------------
-- 3) Pontuação (espelho de `pontosDaTarefa` / `CONFIGURACAO_PONTUACAO`, src/domain/services/pontuacao.ts)
-- ------------------------------------------------------------------------------
-- base(tempo) × dificuldade × prioridade, arredondado; atrasada vale 20%. Os números precisam ser os mesmos da
-- constante TypeScript: o teste de paridade lê este arquivo e compara tudo. Mudou a pontuação, mude nos dois lados.
create or replace function public.pontos_da_tarefa(
  p_tempo int,
  p_dificuldade text,
  p_prioridade text,
  p_atrasada boolean default false
)
returns int
language sql
immutable
set search_path = public
as $$
  select round(
    (case p_tempo when 15 then 2 when 30 then 3 when 60 then 5 when 120 then 8 when 240 then 13 end)::numeric
    * (case p_dificuldade when 'FACIL' then 1 when 'MEDIA' then 1.5 when 'DIFICIL' then 2 end)
    * (case p_prioridade when 'BAIXA' then 1 when 'MEDIA' then 1.2 when 'ALTA' then 1.5 end)
    * (case when p_atrasada then 0.2 else 1 end)
  )::int
$$;

revoke execute on function public.pontos_da_tarefa(int, text, text, boolean) from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4) Fechamento de um sprint
-- ------------------------------------------------------------------------------
-- Ordem obrigatória:
--   1. a foto (total, feitos, %, bônus) é tirada com as tarefas não concluídas AINDA no total;
--   2. só depois as tarefas não concluídas saem do sprint, voltam para a área e ganham
--      `nao_concluida_no_sprint_de` (não passam sozinhas para o próximo sprint);
--   3. as ocorrências de rotina não concluídas ficam como estão (sem conclusão = zero);
--   4. o próximo sprint é criado se ainda não existir.
--
-- Mesma fórmula de `calcularPlacar` (src/domain/services/placarDoSprint.ts): rotina = 40 por dia útil com
-- ocorrência, tudo ou nada (lembretes de fim de semana e datas fora do sprint não contam); tarefa = pontos cheios
-- no total e, se concluída, pontos (20% quando atrasada) nos feitos; bônus por `feitos * 10 >= total * 9`
-- (inteiros, nunca o percentual arredondado, nunca com total 0). Atraso como `tarefaAtrasada`: com hora, concluída
-- depois de início + tempo estimado; sem hora, depois do dia — sempre no relógio de São Paulo.
--
-- Idempotente: sprint com `fechamento_aplicado_em` preenchido não é tocado; sprint já FECHADO mas sem ele (execução
-- interrompida) só refaz os passos 2 a 4, que são idempotentes, sem regravar a foto. Devolve `true` só quando
-- ESTA chamada gravou a foto. Antes de sexta 23:59 (SP) não faz nada.
--
-- SECURITY INVOKER: roda o pg_cron como `postgres` (dono das tabelas, ignora o RLS). EXECUTE revogado da API.
create or replace function public.fechar_sprint(
  p_sprint_id uuid,
  p_agora timestamptz default now()
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_sprint public.sprints%rowtype;
  v_fechou boolean := false;
  v_dias int;
  v_dias_cumpridos int;
  v_qtd int;
  v_concluidas int;
  v_tarefas_total int;
  v_tarefas_feitos int;
  v_total int;
  v_feitos int;
begin
  select * into v_sprint from public.sprints where id = p_sprint_id for update;
  if not found or v_sprint.fechamento_aplicado_em is not null then
    return false;
  end if;
  if p_agora < ((v_sprint.fim + time '23:59') at time zone 'America/Sao_Paulo') then
    return false;
  end if;

  if v_sprint.situacao = 'ABERTO' then
    -- 1) Foto, com as tarefas não concluídas ainda no total.
    select count(*), count(*) filter (where cumprido)
      into v_dias, v_dias_cumpridos
    from (
      select o.data, bool_and(o.concluida_em is not null) as cumprido
      from public.ocorrencias_rotina o
      where o.sprint_id = v_sprint.id and o.user_id = v_sprint.user_id
        and not o.lembrete
        and o.data between v_sprint.inicio and v_sprint.fim
        and extract(isodow from o.data) between 1 and 5
      group by o.data
    ) dias;

    select
      count(*),
      count(*) filter (where concluida),
      coalesce(sum(public.pontos_da_tarefa(tempo, dificuldade, prioridade, false)), 0),
      coalesce(sum(public.pontos_da_tarefa(tempo, dificuldade, prioridade, atrasada)) filter (where concluida), 0)
      into v_qtd, v_concluidas, v_tarefas_total, v_tarefas_feitos
    from (
      select
        t.tempo_estimado_minutos as tempo, t.dificuldade, t.prioridade,
        (t.concluida_em is not null) as concluida,
        (t.concluida_em is not null and (
          case
            when t.hora is null then (t.concluida_em at time zone 'America/Sao_Paulo')::date > t.dia
            else date_trunc('second', t.concluida_em at time zone 'America/Sao_Paulo')
                 > (t.dia + make_time(extract(hour from t.hora)::int, extract(minute from t.hora)::int, 0)
                    + t.tempo_estimado_minutos * interval '1 minute')
          end
        )) as atrasada
      from public.tarefas t
      where t.sprint_id = v_sprint.id and t.user_id = v_sprint.user_id
        and t.arquivada_em is null
        and t.dia between v_sprint.inicio and v_sprint.fim
        and extract(isodow from t.dia) between 1 and 5
        and t.tempo_estimado_minutos is not null and t.dificuldade is not null and t.prioridade is not null
    ) tarefas;

    v_total := v_dias * 40 + v_tarefas_total;
    v_feitos := v_dias_cumpridos * 40 + v_tarefas_feitos;

    update public.sprints
    set situacao = 'FECHADO',
        fechado_em = p_agora,
        foto = jsonb_build_object(
          'total', v_total,
          'feitos', v_feitos,
          'percentual', case when v_total = 0 then 0 else round(v_feitos * 1000.0 / v_total) / 10.0 end,
          'bonus', v_total > 0 and v_feitos * 10 >= v_total * 9,
          'rotina', jsonb_build_object(
            'diasComRotina', v_dias,
            'diasCumpridos', v_dias_cumpridos,
            'pontosPorDia', 40,
            'total', v_dias * 40,
            'feitos', v_dias_cumpridos * 40
          ),
          'tarefas', jsonb_build_object(
            'quantidade', v_qtd,
            'concluidas', v_concluidas,
            'total', v_tarefas_total,
            'feitos', v_tarefas_feitos
          )
        )
    where id = v_sprint.id;
    v_fechou := true;
  end if;

  -- 2) Só agora as tarefas não concluídas saem do sprint e voltam para a área.
  update public.tarefas
  set sprint_id = null, nao_concluida_no_sprint_de = v_sprint.inicio
  where user_id = v_sprint.user_id and sprint_id = v_sprint.id and concluida_em is null;

  -- 4) Próximo sprint, se ainda não existir.
  insert into public.sprints (user_id, inicio, fim)
  values (v_sprint.user_id, v_sprint.inicio + 7, v_sprint.fim + 7)
  on conflict (user_id, inicio) do nothing;

  update public.sprints set fechamento_aplicado_em = p_agora where id = v_sprint.id;
  return v_fechou;
end;
$$;

revoke execute on function public.fechar_sprint(uuid, timestamptz) from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5) Fecha todos os sprints vencidos (o que o job chama)
-- ------------------------------------------------------------------------------
-- Um sprint com problema não trava os demais: o erro vira WARNING e a reserva do backend (ou a próxima
-- execução) tenta de novo. Devolve quantos sprints esta execução fechou.
create or replace function public.fechar_sprints_vencidos(
  p_agora timestamptz default now()
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_fechados int := 0;
begin
  for v_id in
    select s.id
    from public.sprints s
    where s.fechamento_aplicado_em is null
      and p_agora >= ((s.fim + time '23:59') at time zone 'America/Sao_Paulo')
    order by s.inicio
  loop
    begin
      if public.fechar_sprint(v_id, p_agora) then
        v_fechados := v_fechados + 1;
      end if;
    exception when others then
      raise warning 'fechar_sprints_vencidos: sprint % não foi fechado: %', v_id, sqlerrm;
    end;
  end loop;
  return v_fechados;
end;
$$;

revoke execute on function public.fechar_sprints_vencidos(timestamptz) from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 6) Agendamento: sexta 23:59 em São Paulo = sábado 02:59 UTC
-- ------------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

-- `cron.schedule` com um nome já existente só atualiza o job — a migration é reaplicável.
select cron.schedule(
  'fechar-sprints-vencidos',
  '59 2 * * 6',
  $$select public.fechar_sprints_vencidos()$$
);
