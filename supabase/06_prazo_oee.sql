-- 06_prazo_oee.sql · caminho crítico (linha de base, atualizado e sub-rede) e OEE da operação.
-- Rode no SQL Editor do Supabase DEPOIS do 05_funcoes.sql. Pode rodar de novo sem problema.
-- Convenções (Anexo D): duração por esforço = ⌈Q × RUP ÷ (efetivo × 8)⌉; TI: IC(suc) ≥ TC(pred) + 1 + defasagem;
-- II: IC(suc) ≥ IC(pred) + defasagem; tudo em dias úteis (du 1 = 01/12/2025).

-- ============ motor da rede (ida e volta) para um conjunto de atividades
-- p_ids: atividades consideradas (null = todas) · p_dur: duração de cada uma · p_ini_min: início mínimo (du) de cada uma
create or replace function public.fn_rede(p_ids text[], p_dur jsonb, p_ini_min jsonb default '{}'::jsonb)
returns table (id_atividade text, duracao_du int, ic_du int, tc_du int, it_du int, tt_du int, folga_total_du int, critica boolean)
language plpgsql stable as $$
declare
  ids text[]; d int[]; ic int[]; tc int[]; itd int[]; ttd int[];
  ds int[]; dp int[]; dt text[]; dl int[];       -- ligações: sucessora, predecessora (índices), tipo, defasagem
  pos jsonb := '{}'; n int; m int; i int; k int; v int; mudou boolean; fim int; passos int := 0;
begin
  select array_agg(a.id_atividade order by a.id_atividade) into ids from public.atividades a where p_ids is null or a.id_atividade = any(p_ids);
  n := coalesce(array_length(ids, 1), 0);
  for i in 1..n loop
    pos := pos || jsonb_build_object(ids[i], i);
    d[i] := (p_dur ->> ids[i])::int;
    ic[i] := greatest(1, coalesce((p_ini_min ->> ids[i])::int, 1));
    tc[i] := ic[i] + d[i] - 1;
  end loop;
  select array_agg((pos ->> x.id_atividade_sucessora)::int), array_agg((pos ->> x.id_atividade_predecessora)::int), array_agg(x.tipo_dependencia), array_agg(x.defasagem_du)
    into ds, dp, dt, dl
    from public.dependencias x where pos ? x.id_atividade_sucessora and pos ? x.id_atividade_predecessora;
  m := coalesce(array_length(ds, 1), 0);
  loop  -- ida: relaxa as ligações até estabilizar (rede acíclica)
    mudou := false; passos := passos + 1;
    for k in 1..m loop
      v := case when dt[k] = 'TI' then tc[dp[k]] + 1 + dl[k] else ic[dp[k]] + dl[k] end;
      if v > ic[ds[k]] then ic[ds[k]] := v; tc[ds[k]] := v + d[ds[k]] - 1; mudou := true; end if;
    end loop;
    exit when not mudou or passos > n + 1;
  end loop;
  fim := (select max(x) from unnest(tc) x);
  for i in 1..n loop ttd[i] := fim; itd[i] := fim - d[i] + 1; end loop;
  passos := 0;
  loop  -- volta
    mudou := false; passos := passos + 1;
    for k in 1..m loop
      v := case when dt[k] = 'TI' then itd[ds[k]] - 1 - dl[k] else itd[ds[k]] - dl[k] + d[dp[k]] - 1 end;
      if v < ttd[dp[k]] then ttd[dp[k]] := v; itd[dp[k]] := v - d[dp[k]] + 1; mudou := true; end if;
    end loop;
    exit when not mudou or passos > n + 1;
  end loop;
  return query select ids[g.j], d[g.j], ic[g.j], tc[g.j], itd[g.j], ttd[g.j], itd[g.j] - ic[g.j], itd[g.j] = ic[g.j]
               from generate_subscripts(ids, 1) as g(j) order by ic[g.j], ids[g.j];
end $$;

-- duração orçada (Anexo D) de cada atividade, calculada pela RUP: base comum para as funções abaixo
create or replace function public.fn_duracoes() returns jsonb language sql stable as $$
  select jsonb_object_agg(a.id_atividade,
           case when a.tipo_duracao = 'FIXA' then a.duracao_fixa_du
                else ceil(round(a.quantidade_orcada * a.rup_orcada_hh_un / (e.ef * 8), 6))::int end)
  from public.atividades a
  left join (select id_atividade, sum(quantidade) ef from public.atividade_recursos where tipo_recurso = 'MAO_DE_OBRA' group by 1) e using (id_atividade)
$$;

-- ============ linha de base (D2) recalculada no banco: deve bater com a tabela linha_base
create or replace function public.fn_cpm_linha_base()
returns table (id_atividade text, nome_atividade text, duracao_du int, ic_du int, tc_du int, it_du int, tt_du int, folga_total_du int,
               critica boolean, inicio date, termino date)
language sql stable as $$
  select r.id_atividade, a.nome_atividade, r.duracao_du, r.ic_du, r.tc_du, r.it_du, r.tt_du, r.folga_total_du, r.critica,
         (select data from public.calendario where dia_util_projeto = r.ic_du), (select data from public.calendario where dia_util_projeto = r.tc_du)
  from public.fn_rede(null, public.fn_duracoes()) r join public.atividades a using (id_atividade)
$$;

-- ============ sub-rede (folha M1): só as atividades informadas e as ligações entre elas, começando no du 1
create or replace function public.fn_cpm_subrede(p_ids text[] default array['A23','A24','A25','A26','A27','A28','A29','A30','A31','A35','A36'])
returns table (id_atividade text, nome_atividade text, duracao_du int, ic_du int, tc_du int, it_du int, tt_du int, folga_total_du int, critica boolean)
language sql stable as $$
  select r.id_atividade, a.nome_atividade, r.duracao_du, r.ic_du, r.tc_du, r.it_du, r.tt_du, r.folga_total_du, r.critica
  from public.fn_rede(p_ids, public.fn_duracoes()) r join public.atividades a using (id_atividade)
$$;

-- ============ caminho crítico ATUALIZADO na data de status (Parte 3: previsão de término)
-- Premissas: concluída (avanço ≥ 99,9%) = fixada no que já aconteceu (tc ≤ du do status);
-- em andamento = saldo ⌈duração × (1 − avanço)⌉ a partir do du seguinte ao status;
-- não iniciada = começa no mínimo no du seguinte ao status, respeitando as predecessoras; produtividade orçada daqui em diante.
create or replace function public.fn_cpm_atualizado(p_data date default '2026-11-13')
returns table (id_atividade text, nome_atividade text, situacao text, avanco numeric, duracao_restante_du int, ic_du int, tc_du int,
               folga_total_du int, critica boolean, termino_previsto date, tc_linha_base_du int, desvio_du int)
language plpgsql stable as $$
declare s int := public.fn_du(p_data); dur jsonb := '{}'; ini jsonb := '{}'; r record;
begin
  for r in select av.id_atividade, av.avanco, lb.duracao_du from public.fn_avanco_atividade(p_data) av join public.linha_base lb using (id_atividade) loop
    if r.avanco >= 0.999 then
      dur := dur || jsonb_build_object(r.id_atividade, 1);  ini := ini || jsonb_build_object(r.id_atividade, 1);
    elsif r.avanco > 0 then
      dur := dur || jsonb_build_object(r.id_atividade, greatest(1, ceil(r.duracao_du * (1 - r.avanco))::int)); ini := ini || jsonb_build_object(r.id_atividade, s + 1);
    else
      dur := dur || jsonb_build_object(r.id_atividade, r.duracao_du); ini := ini || jsonb_build_object(r.id_atividade, s + 1);
    end if;
  end loop;
  return query
  with rede as (select * from public.fn_rede(null, dur, ini)), av as (select * from public.fn_avanco_atividade(p_data))
  select rede.id_atividade, av.nome_atividade,
         case when av.avanco >= 0.999 then 'CONCLUÍDA' when av.avanco > 0 then 'EM ANDAMENTO' else 'NÃO INICIADA' end,
         round(av.avanco, 4), case when av.avanco >= 0.999 then 0 else rede.duracao_du end,
         case when av.avanco >= 0.999 then null else rede.ic_du end, case when av.avanco >= 0.999 then null else rede.tc_du end,
         case when av.avanco >= 0.999 then null else rede.folga_total_du end,
         av.avanco < 0.999 and rede.critica,
         case when av.avanco >= 0.999 then null else (select data from public.calendario where dia_util_projeto = rede.tc_du) end,
         lb.tc_du, case when av.avanco >= 0.999 then null else rede.tc_du - lb.tc_du end
  from rede join av using (id_atividade) join public.linha_base lb using (id_atividade)
  order by rede.ic_du, rede.id_atividade;
end $$;

create or replace function public.fn_prazo(p_data date default '2026-11-13')
returns jsonb language sql stable as $$
  -- Resumo de prazo: término da linha de base, previsão atualizada, data contratual, atraso, multa e ganho operacional perdido
  with a as (select max(tc_du) filter (where tc_du is not null) fim from public.fn_cpm_atualizado(p_data)),
       c as (select dia_util_projeto du from public.calendario where data = (select valor::date from public.projeto_parametros where parametro = 'data_contratual_entrega')),
       p as (select (select valor::numeric from public.projeto_parametros where parametro = 'multa_atraso_dia_rs') multa,
                    (select valor::numeric from public.projeto_parametros where parametro = 'ganho_operacional_dia_rs') ganho)
  select jsonb_build_object(
    'du_status', public.fn_du(p_data),
    'termino_lb_du', (select max(tc_du) from public.linha_base),
    'termino_lb', (select data from public.calendario where dia_util_projeto = (select max(tc_du) from public.linha_base)),
    'termino_previsto_du', (select fim from a),
    'termino_previsto', (select data from public.calendario where dia_util_projeto = (select fim from a)),
    'contrato_du', (select du from c),
    'contrato', (select valor from public.projeto_parametros where parametro = 'data_contratual_entrega'),
    'atraso_vs_lb_du', (select fim from a) - (select max(tc_du) from public.linha_base),
    'atraso_vs_contrato_du', greatest(0, (select fim from a) - (select du from c)),
    'multa_rs', greatest(0, (select fim from a) - (select du from c)) * (select multa from p),
    'ganho_perdido_rs', greatest(0, (select fim from a) - (select max(tc_du) from public.linha_base)) * (select ganho from p),
    'caminho_critico', (select jsonb_agg(id_atividade order by ic_du) from public.fn_cpm_atualizado(p_data) where critica))
$$;

-- ============ OEE (tabela 27, convenção do Anexo D)
create or replace function public.fn_oee(p_ini date default '2000-01-01', p_fim date default '2099-12-31', p_posto text default null, p_turno int default null)
returns table (id_posto text, nome_posto text, turnos int, programado_min numeric, operando_min numeric, disponibilidade numeric,
               eficiencia numeric, qualidade numeric, oee numeric, oee_previsto numeric)
language sql stable as $$
  -- operando = programado − parada planejada − não planejada − setup; D = operando ÷ (programado − planejada);
  -- E = (quantidade × ciclo padrão) ÷ operando; Q = (produzida − refugada) ÷ produzida
  select p.id_posto, pp.nome_posto, count(*)::int, sum(tempo_programado_min),
         sum(tempo_programado_min - parada_planejada_min - parada_nao_planejada_min - setup_min),
         round(sum(tempo_programado_min - parada_planejada_min - parada_nao_planejada_min - setup_min)::numeric / nullif(sum(tempo_programado_min - parada_planejada_min),0), 4),
         round(sum(quantidade_produzida) * min(pp.tempo_ciclo_padrao_s) / 60 / nullif(sum(tempo_programado_min - parada_planejada_min - parada_nao_planejada_min - setup_min),0), 4),
         round((sum(quantidade_produzida) - sum(quantidade_refugada)) / nullif(sum(quantidade_produzida),0), 4),
         round(sum(tempo_programado_min - parada_planejada_min - parada_nao_planejada_min - setup_min)::numeric / nullif(sum(tempo_programado_min - parada_planejada_min),0)
             * sum(quantidade_produzida) * min(pp.tempo_ciclo_padrao_s) / 60 / nullif(sum(tempo_programado_min - parada_planejada_min - parada_nao_planejada_min - setup_min),0)
             * (sum(quantidade_produzida) - sum(quantidade_refugada)) / nullif(sum(quantidade_produzida),0), 4),
         round(min(pp.disponibilidade_prevista * pp.eficiencia_prevista * pp.qualidade_prevista), 4)
  from public.producao_apontamento p join public.processo_postos pp using (id_posto)
  where p.data between p_ini and p_fim and (p_posto is null or p.id_posto = p_posto) and (p_turno is null or p.turno = p_turno)
  group by p.id_posto, pp.nome_posto order by p.id_posto
$$;

grant execute on all functions in schema public to anon, authenticated;
