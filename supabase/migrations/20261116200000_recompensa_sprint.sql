-- Recompensa do sprint e histórico (issue #72).
-- A recompensa é um texto livre ("pedir pizza"), sem nenhuma ligação com as finanças. Cada sprint pode ter a sua;
-- sem ela vale a padrão do usuário. A meta é sempre 90% do total (o bônus do placar não muda).
-- A recompensa vale NO FECHAMENTO: a foto grava a recompensa efetiva daquele instante e o histórico lê só a foto.
-- Não edita a migration 20261116190000: só redefine (create or replace) o que ela criou.

-- ------------------------------------------------------------------------------
-- 1) Colunas
-- ------------------------------------------------------------------------------
-- Gravado já aparado e nunca vazio (a API troca vazio por nulo); nulo = sem recompensa própria.
alter table public.sprints
  add column if not exists recompensa text;

alter table public.sprints
  drop constraint if exists sprints_recompensa_check;
alter table public.sprints
  add constraint sprints_recompensa_check check (recompensa is null or char_length(recompensa) between 1 and 120);

alter table public.profiles
  add column if not exists recompensa_padrao text;

alter table public.profiles
  drop constraint if exists profiles_recompensa_padrao_check;
alter table public.profiles
  add constraint profiles_recompensa_padrao_check
  check (recompensa_padrao is null or char_length(recompensa_padrao) between 1 and 120);

-- ------------------------------------------------------------------------------
-- 2) Sprint fechado é imutável, agora também na recompensa
-- ------------------------------------------------------------------------------
create or replace function public.sprints_foto_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.situacao = 'FECHADO'
     and (new.situacao, new.foto, new.fechado_em, new.recompensa)
         is distinct from (old.situacao, old.foto, old.fechado_em, old.recompensa) then
    raise exception 'Sprint fechado é imutável.';
  end if;
  return new;
end;
$$;

revoke execute on function public.sprints_foto_imutavel() from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3) Fechamento: a foto passa a levar a recompensa efetiva e o detalhe de tarefas e rotina
-- ------------------------------------------------------------------------------
-- Mesma função, mesma ordem e mesma idempotência da #71 (foto -> devolver não concluídas -> próximo sprint ->
-- `fechamento_aplicado_em`). Novidades, só dentro da foto (o formato do placar continua igual, com chaves a mais):
--   * `recompensa`: texto efetivo no instante do fechamento = a do sprint, senão a padrão vigente, senão nulo;
--   * `detalhe.tarefas`: cada tarefa pontuável com título, dia, hora, pontos, pontos ganhos e situação
--     (CONCLUIDA / ATRASADA / NAO_CONCLUIDA);
--   * `detalhe.rotina`: por dia útil, se foi cumprido e os itens (nome, hora, concluída).
-- O histórico lê isto e não as tarefas ao vivo: as não concluídas saem do sprint logo em seguida e as demais podem
-- ser excluídas ou arquivadas depois. Espelho em TypeScript: `montarFoto` (src/domain/services/fotoDoSprint.ts).
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
  v_rotina_detalhe jsonb;
  v_qtd int;
  v_concluidas int;
  v_tarefas_total int;
  v_tarefas_feitos int;
  v_tarefas_detalhe jsonb;
  v_total int;
  v_feitos int;
  v_recompensa text;
begin
  select * into v_sprint from public.sprints where id = p_sprint_id for update;
  if not found or v_sprint.fechamento_aplicado_em is not null then
    return false;
  end if;
  if p_agora < ((v_sprint.fim + time '23:59') at time zone 'America/Sao_Paulo') then
    return false;
  end if;

  if v_sprint.situacao = 'ABERTO' then
    -- Recompensa efetiva no instante do fechamento: a do sprint ou a padrão vigente.
    select coalesce(
      nullif(btrim(v_sprint.recompensa), ''),
      (select nullif(btrim(p.recompensa_padrao), '') from public.profiles p where p.id = v_sprint.user_id)
    ) into v_recompensa;

    -- 1) Foto, com as tarefas não concluídas ainda no total.
    select count(*), count(*) filter (where cumprido),
           coalesce(jsonb_agg(jsonb_build_object('data', data, 'cumprido', cumprido, 'itens', itens) order by data), '[]'::jsonb)
      into v_dias, v_dias_cumpridos, v_rotina_detalhe
    from (
      select o.data, bool_and(o.concluida_em is not null) as cumprido,
             jsonb_agg(
               jsonb_build_object('nome', o.nome, 'hora', o.hora, 'concluida', o.concluida_em is not null)
               order by o.ordem, o.id
             ) as itens
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
      coalesce(sum(pontos), 0),
      coalesce(sum(ganhos), 0),
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'titulo', titulo,
            'dia', dia,
            'hora', left(hora::text, 5),
            'tempoEstimado', tempo,
            'dificuldade', dificuldade,
            'prioridade', prioridade,
            'pontos', pontos,
            'pontosGanhos', ganhos,
            'situacao', case when not concluida then 'NAO_CONCLUIDA' when atrasada then 'ATRASADA' else 'CONCLUIDA' end
          )
          order by dia, hora nulls last, titulo, id
        ),
        '[]'::jsonb
      )
      into v_qtd, v_concluidas, v_tarefas_total, v_tarefas_feitos, v_tarefas_detalhe
    from (
      select
        t.id, t.titulo, t.dia, t.hora,
        t.tempo_estimado_minutos as tempo, t.dificuldade, t.prioridade,
        (t.concluida_em is not null) as concluida,
        (t.concluida_em is not null and (
          case
            when t.hora is null then (t.concluida_em at time zone 'America/Sao_Paulo')::date > t.dia
            else date_trunc('second', t.concluida_em at time zone 'America/Sao_Paulo')
                 > (t.dia + make_time(extract(hour from t.hora)::int, extract(minute from t.hora)::int, 0)
                    + t.tempo_estimado_minutos * interval '1 minute')
          end
        )) as atrasada,
        public.pontos_da_tarefa(t.tempo_estimado_minutos, t.dificuldade, t.prioridade, false) as pontos,
        case
          when t.concluida_em is null then 0
          else public.pontos_da_tarefa(
            t.tempo_estimado_minutos, t.dificuldade, t.prioridade,
            case
              when t.hora is null then (t.concluida_em at time zone 'America/Sao_Paulo')::date > t.dia
              else date_trunc('second', t.concluida_em at time zone 'America/Sao_Paulo')
                   > (t.dia + make_time(extract(hour from t.hora)::int, extract(minute from t.hora)::int, 0)
                      + t.tempo_estimado_minutos * interval '1 minute')
            end
          )
        end as ganhos
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
          ),
          'recompensa', v_recompensa,
          'detalhe', jsonb_build_object('tarefas', v_tarefas_detalhe, 'rotina', v_rotina_detalhe)
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
