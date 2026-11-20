-- 05_funcoes.sql · funções de cálculo do sistema (Anexo D). Rode depois das cargas.
-- Todas recebem a data de corte (p_data) e podem ser chamadas pelo site com supabase.rpc('nome', {p_data: '2026-11-13'}).
-- Convenções: Anexo D do enunciado. Cada função diz de quais tabelas sai o número (requisito "número sem fonte é opinião").

-- ============ utilidades
create or replace function public.fn_du(p_data date) returns integer language sql stable as $$
  -- dia útil do projeto na data (último du <= p_data). Fonte: calendario
  select coalesce(max(dia_util_projeto), 0)::int from public.calendario where dia_util = 1 and data <= p_data
$$;

create or replace function public.fn_norm_causa(t text) returns text language sql immutable as $$
  -- padroniza a causa digitada à mão: maiúsculas, sem acento, espaço vira _
  select nullif(upper(replace(replace(trim(translate(coalesce(t,''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), ' ', '_'), '-', '_')), '')
$$;

-- ============ R4 · avanço físico por atividade
create or replace function public.fn_avanco_atividade(p_data date default '2026-11-13')
returns table (id_atividade text, nome_atividade text, fase text, id_zona text, unidade text, encarregado text,
               quantidade_orcada numeric, quantidade_executada numeric, avanco numeric, custo_orcado numeric,
               va numeric, ic_du int, tc_du int, duracao_du int, critica int, pct_planejado numeric, desvio_pp numeric)
language sql stable as $$
  -- Fonte: atividades, rdo_producao (data <= p_data), orcamento, linha_base. Avanço = Σ executado ÷ orçado, limitado a 100%.
  with q as (select id_atividade, sum(quantidade_executada) qe from public.rdo_producao where data <= p_data group by 1),
       du as (select public.fn_du(p_data) d)
  select a.id_atividade, a.nome_atividade, a.fase, a.id_zona, a.unidade, a.encarregado,
         a.quantidade_orcada, coalesce(q.qe,0),
         least(1, coalesce(q.qe,0) / nullif(a.quantidade_orcada,0)) as avanco,
         o.custo_total_rs,
         least(1, coalesce(q.qe,0) / nullif(a.quantidade_orcada,0)) * o.custo_total_rs as va,
         lb.ic_du, lb.tc_du, lb.duracao_du, lb.critica,
         greatest(0, least(1, (du.d - lb.ic_du + 1)::numeric / lb.duracao_du)) as pct_planejado,
         round((least(1, coalesce(q.qe,0) / nullif(a.quantidade_orcada,0)) - greatest(0, least(1, (du.d - lb.ic_du + 1)::numeric / lb.duracao_du))) * 100, 1)
  from public.atividades a
  join public.orcamento o using (id_atividade)
  join public.linha_base lb using (id_atividade)
  cross join du
  left join q using (id_atividade)
  order by a.id_atividade
$$;

-- ============ R5 · valor agregado por atividade, fase e total
create or replace function public.fn_evm_atividade(p_data date default '2026-11-13')
returns table (id_atividade text, fase text, custo_orcado numeric, vp numeric, va numeric, cr numeric, avanco numeric, pct_planejado numeric)
language sql stable as $$
  -- VP: custo linear nos du da linha base (linha_base × orcamento × calendario). VA: fn_avanco_atividade. CR: custos_apropriados, categoria <> 'INDIRETO', data <= p_data
  with c as (select id_atividade, sum(valor_rs) cr from public.custos_apropriados
             where categoria <> 'INDIRETO' and data <= p_data group by 1)
  select av.id_atividade, av.fase, av.custo_orcado, av.custo_orcado * av.pct_planejado, av.va, coalesce(c.cr,0), av.avanco, av.pct_planejado
  from public.fn_avanco_atividade(p_data) av left join c using (id_atividade)
$$;

create or replace function public.fn_evm_fase(p_data date default '2026-11-13')
returns table (fase text, ordem int, orcamento numeric, vp numeric, va numeric, cr numeric, var_prazo numeric, var_custo numeric,
               idp numeric, idc numeric, eat numeric, avanco_fisico numeric)
language sql stable as $$
  -- EAT (estimativa no término) = orçamento ÷ IDC (Anexo D). Linha TOTAL inclui custo direto sem atividade (DIVERSOS), se houver.
  with e as (select * from public.fn_evm_atividade(p_data)),
       sem_ativ as (select coalesce(sum(valor_rs),0) v from public.custos_apropriados
                    where categoria <> 'INDIRETO' and data <= p_data and id_atividade is null),
       f as (select e.fase, min(e.id_atividade) ord, sum(custo_orcado) orc, sum(vp) vp, sum(va) va, sum(cr) cr from e group by e.fase
             union all
             select 'TOTAL', 'Z', sum(custo_orcado), sum(vp), sum(va), sum(cr) + (select v from sem_ativ) from e)
  select f.fase, row_number() over (order by f.ord)::int, round(orc,2), round(vp,2), round(va,2), round(cr,2), round(va - vp,2), round(va - cr,2),
         round(va / nullif(vp,0), 4), round(va / nullif(cr,0), 4), round(orc / nullif(va / nullif(cr,0),0), 2), round(va / nullif(orc,0), 4)
  from f order by f.ord
$$;

create or replace function public.fn_cr_natureza(p_data date default '2026-11-13')
returns table (categoria text, orcado numeric, cr numeric)
language sql stable as $$
  -- CR por natureza (custos_apropriados) × orçado por natureza (orcamento). INDIRETO = administração local, acompanhada à parte.
  select n.cat,
         case n.cat when 'MAO_DE_OBRA' then (select sum(custo_mao_de_obra_rs) from public.orcamento)
                    when 'SUBCONTRATO' then (select sum(custo_subcontrato_rs) from public.orcamento)
                    when 'MATERIAL' then (select sum(custo_material_rs) from public.orcamento)
                    when 'EQUIPAMENTO' then (select sum(custo_equipamento_rs) from public.orcamento) end,
         coalesce((select sum(valor_rs) from public.custos_apropriados c where c.categoria = n.cat and c.data <= p_data), 0)
  from (values ('MAO_DE_OBRA'),('SUBCONTRATO'),('MATERIAL'),('EQUIPAMENTO'),('INDIRETO')) n(cat)
$$;

create or replace function public.fn_curva_s(p_ate date default '2027-01-31')
returns table (semana text, data_fim date, vp_acum numeric, va_acum numeric, cr_acum numeric, idp numeric, idc numeric)
language sql stable as $$
  -- Curva S semanal (último du de cada semana). VA e CR só até a última data com apontamento.
  with s as (select semana, max(data) d from public.calendario where dia_util = 1 and data <= p_ate group by semana),
       ult as (select greatest((select max(data) from public.rdo_producao), (select max(data) from public.custos_apropriados)) u)
  select s.semana, s.d,
         round(sum(e.vp),2),
         case when s.d <= (select u from ult) + 6 then round(sum(e.va),2) end,
         case when s.d <= (select u from ult) + 6 then round(sum(e.cr),2) end,
         case when s.d <= (select u from ult) + 6 then round(sum(e.va)/nullif(sum(e.vp),0),4) end,
         case when s.d <= (select u from ult) + 6 then round(sum(e.va)/nullif(sum(e.cr),0),4) end
  from s cross join lateral public.fn_evm_atividade(s.d) e
  group by s.semana, s.d order by s.d
$$;

-- ============ R6 · PPC e Pareto
create or replace function public.fn_ppc_semana()
returns table (semana text, data_inicio date, planejados int, concluidos int, ppc numeric)
language sql stable as $$
  -- Fonte: plano_semanal. Concluído = realizado >= 97% da meta (Anexo D), recalculado aqui para não depender do campo digitado.
  select semana, min(data_inicio_semana), count(*)::int,
         count(*) filter (where coalesce(quantidade_realizada,0) >= 0.97 * meta_quantidade)::int,
         round(count(*) filter (where coalesce(quantidade_realizada,0) >= 0.97 * meta_quantidade)::numeric / count(*), 4)
  from public.plano_semanal group by semana order by semana
$$;

create or replace function public.fn_pareto_causas(p_semana_ini text default '2000-S01', p_semana_fim text default '2099-S53')
returns table (causa text, ocorrencias int, pct numeric, pct_acum numeric)
language sql stable as $$
  -- Fonte: plano_semanal, pacotes não concluídos, causa padronizada por fn_norm_causa
  with c as (select public.fn_norm_causa(causa_nao_cumprimento) causa, count(*)::int n from public.plano_semanal
             where semana between p_semana_ini and p_semana_fim and coalesce(quantidade_realizada,0) < 0.97 * meta_quantidade
             group by 1)
  select coalesce(causa,'SEM_CAUSA'), n, round(n::numeric / sum(n) over (), 4),
         round(sum(n) over (order by n desc, causa rows unbounded preceding)::numeric / sum(n) over (), 4)
  from c order by n desc, causa
$$;

-- ============ R7 · RUP real × orçada
create or replace function public.fn_rup(p_data date default '2026-11-13')
returns table (id_atividade text, nome_atividade text, encarregado text, unidade text, hh numeric, quantidade numeric,
               rup_real numeric, rup_orcada numeric, desvio_pct numeric)
language sql stable as $$
  -- RUP real = Hh apontadas (normais + extras, rdo_mao_de_obra) ÷ quantidade executada (rdo_producao). Só atividades por esforço.
  with h as (select id_atividade, sum(horas_normais + horas_extras) hh from public.rdo_mao_de_obra where data <= p_data group by 1),
       q as (select id_atividade, sum(quantidade_executada) qe from public.rdo_producao where data <= p_data group by 1)
  select a.id_atividade, a.nome_atividade, a.encarregado, a.unidade, h.hh, q.qe, round(h.hh / q.qe, 4), a.rup_orcada_hh_un,
         round((h.hh / q.qe / a.rup_orcada_hh_un - 1) * 100, 1)
  from public.atividades a join h using (id_atividade) join q using (id_atividade)
  where a.tipo_duracao = 'ESFORCO' and q.qe > 0
  order by 9 desc
$$;

create or replace function public.fn_rup_encarregado(p_data date default '2026-11-13')
returns table (encarregado text, atividades int, hh_real numeric, hh_orcadas_para_o_executado numeric, desvio_pct numeric)
language sql stable as $$
  -- Desvio ponderado: Σ Hh reais ÷ Σ (quantidade executada × RUP orçada) − 1
  select encarregado, count(*)::int, round(sum(hh),1), round(sum(quantidade * rup_orcada),1),
         round((sum(hh) / sum(quantidade * rup_orcada) - 1) * 100, 1)
  from public.fn_rup(p_data) group by encarregado order by 5 desc
$$;

-- ============ R8 · histograma real × previsto e absenteísmo
create or replace function public.fn_histograma(p_ini date default '2025-12-01', p_fim date default '2026-11-13')
returns table (data date, du int, efetivo_linha_base int, efetivo_escalado int, efetivo_presente int, absenteismo numeric)
language sql stable as $$
  -- Linha de base: equipe (atividade_recursos) nos du IC..TC (linha_base). Real: rdo_mao_de_obra.
  with cal as (select data, dia_util_projeto du from public.calendario where dia_util = 1 and data between p_ini and p_fim),
       lb as (select c.data, sum(lb.efetivo)::int e from cal c join public.linha_base lb on c.du between lb.ic_du and lb.tc_du group by 1),
       r as (select data, sum(efetivo_previsto)::int prev, sum(efetivo_presente)::int pres from public.rdo_mao_de_obra
             where data between p_ini and p_fim group by 1)
  select cal.data, cal.du, coalesce(lb.e,0), coalesce(r.prev,0), coalesce(r.pres,0),
         round(1 - r.pres::numeric / nullif(r.prev,0), 4)
  from cal left join lb using (data) left join r using (data) order by 1
$$;

-- ============ R9 · suprimentos
create or replace function public.fn_pedidos(p_data date default '2026-11-13')
returns table (id_pedido text, id_material text, id_atividade text, id_fornecedor text, nome_fornecedor text, tipo_pedido text,
               data_pedido date, data_necessidade_obra date, data_prometida date, data_entrega date, situacao text, atraso_dias int)
language sql stable as $$
  -- Situação na data: ABERTO_NO_PRAZO, ABERTO_ATRASADO (prometida < p_data), ENTREGUE_COM_ATRASO (entrega > necessidade da obra), ENTREGUE_NO_PRAZO
  select p.id_pedido, p.id_material, p.id_atividade, p.id_fornecedor, f.nome_fornecedor, p.tipo_pedido,
         p.data_pedido, p.data_necessidade_obra, p.data_prometida, p.data_entrega,
         case when p.data_entrega is null or p.data_entrega > p_data then
                case when p.data_prometida < p_data then 'ABERTO_ATRASADO' else 'ABERTO_NO_PRAZO' end
              when p.data_entrega > p.data_necessidade_obra then 'ENTREGUE_COM_ATRASO' else 'ENTREGUE_NO_PRAZO' end,
         case when p.data_entrega is null or p.data_entrega > p_data then greatest(0, p_data - p.data_prometida)
              else greatest(0, p.data_entrega - p.data_necessidade_obra) end
  from public.compras_pedidos p left join public.fornecedores f using (id_fornecedor)
  where p.data_pedido <= p_data order by p.data_pedido
$$;

create or replace function public.fn_fornecedores(p_data date default '2026-11-13')
returns table (id_fornecedor text, nome_fornecedor text, pedidos int, entregues int, entregues_com_atraso int, pct_atraso numeric,
               atraso_medio_dias numeric, abertos_atrasados int, rejeicao_fvm_pct numeric, frete_expresso_rs numeric)
language sql stable as $$
  -- Desempenho por fornecedor (compras_pedidos). Atraso = entrega após a necessidade da obra (linha de base).
  select fp.id_fornecedor, fp.nome_fornecedor, count(*)::int,
         count(*) filter (where fp.situacao like 'ENTREGUE%')::int,
         count(*) filter (where fp.situacao = 'ENTREGUE_COM_ATRASO')::int,
         round(count(*) filter (where fp.situacao = 'ENTREGUE_COM_ATRASO')::numeric / nullif(count(*) filter (where fp.situacao like 'ENTREGUE%'),0), 4),
         round(avg(fp.atraso_dias) filter (where fp.situacao = 'ENTREGUE_COM_ATRASO'), 1),
         count(*) filter (where fp.situacao = 'ABERTO_ATRASADO')::int,
         round(sum(p.quantidade_rejeitada_fvm) / nullif(sum(p.quantidade_pedida) filter (where p.data_entrega <= p_data),0), 4),
         round(sum(p.frete_rs), 2)
  from public.fn_pedidos(p_data) fp join public.compras_pedidos p using (id_pedido)
  group by fp.id_fornecedor, fp.nome_fornecedor order by 5 desc
$$;

create or replace function public.fn_alerta_data_limite(p_data date default '2026-11-13', p_margem int default 5)
returns table (id_material text, id_atividade text, data_uso date, lead_time_du int, data_limite date, ja_pedido boolean, situacao text)
language sql stable as $$
  -- Data-limite do pedido = data de uso (IC da linha base) − lead time − margem (em du). Alerta para usos sem pedido.
  with u as (select am.id_material, am.id_atividade, lb.ic_du, m.lead_time_du,
                    (select data from public.calendario where dia_util_projeto = lb.ic_du) data_uso,
                    (select data from public.calendario where dia_util_projeto = greatest(1, lb.ic_du - m.lead_time_du - p_margem)) data_limite
             from public.atividade_materiais am join public.linha_base lb using (id_atividade) join public.materiais m using (id_material))
  select u.id_material, u.id_atividade, u.data_uso, u.lead_time_du, u.data_limite,
         exists (select 1 from public.compras_pedidos p where p.id_material = u.id_material and p.id_atividade = u.id_atividade and p.data_pedido <= p_data),
         case when exists (select 1 from public.compras_pedidos p where p.id_material = u.id_material and p.id_atividade = u.id_atividade and p.data_pedido <= p_data)
              then 'PEDIDO EMITIDO'
              when u.data_limite < p_data then 'DATA-LIMITE VENCIDA'
              when u.data_limite <= p_data + 14 then 'VENCE EM ATÉ 14 DIAS' else 'OK' end
  from u order by u.data_limite
$$;

-- ============ R10 · equipamentos
create or replace function public.fn_equipamentos(p_ini date default '2025-12-01', p_data date default '2026-11-13')
returns table (tipo_equipamento text, descricao text, unidades int, diarias int, diarias_sem_frente int, horas_disponiveis numeric,
               horas_operando numeric, horas_corretiva numeric, horas_preventiva numeric, falhas int,
               disponibilidade numeric, utilizacao numeric, mtbf_h numeric, mttr_h numeric, custo_diarias_sem_frente numeric)
language sql stable as $$
  -- Anexo D: disponibilidade = 1 − (corretiva + preventiva) ÷ horas disponíveis; MTBF = operando ÷ falhas; MTTR = corretiva ÷ falhas.
  -- Utilização = horas operando ÷ horas disponíveis. Diária sem frente = dia sem atividade apontada (equip_apontamento).
  select e.tipo_equipamento, min(e.descricao), count(distinct a.id_equipamento)::int, count(*)::int,
         count(*) filter (where a.id_atividade is null)::int,
         sum(a.horas_disponiveis), sum(a.horas_operando), sum(a.horas_manutencao_corretiva), sum(a.horas_manutencao_preventiva), sum(a.numero_falhas)::int,
         round(1 - (sum(a.horas_manutencao_corretiva) + sum(a.horas_manutencao_preventiva)) / nullif(sum(a.horas_disponiveis),0), 4),
         round(sum(a.horas_operando) / nullif(sum(a.horas_disponiveis),0), 4),
         round(sum(a.horas_operando) / nullif(sum(a.numero_falhas),0), 1),
         round(sum(a.horas_manutencao_corretiva) / nullif(sum(a.numero_falhas),0), 2),
         round(sum(e.diaria_contratada_rs) filter (where a.id_atividade is null), 2)
  from public.equip_apontamento a join public.equipamentos e using (id_equipamento)
  where a.data between p_ini and p_data
  group by e.tipo_equipamento order by 1
$$;

-- ============ R12 · avanço por zona (modelo 3D)
create or replace function public.fn_zonas(p_data date default '2026-11-13')
returns table (id_zona text, nome_zona text, tipo_zona text, x_m numeric, y_m numeric, largura_x_m numeric, comprimento_y_m numeric,
               altura_m numeric, avanco numeric, pct_planejado numeric, critica_atrasada boolean, atividades jsonb)
language sql stable as $$
  -- Avanço da zona = média do avanço das atividades da zona ponderada pelo custo orçado (Anexo B).
  -- critica_atrasada: alguma atividade crítica da zona com avanço 10 p.p. ou mais abaixo do planejado.
  select z.id_zona, z.nome_zona, z.tipo_zona, z.x_m, z.y_m, z.largura_x_m, z.comprimento_y_m, z.altura_m,
         round(sum(av.avanco * av.custo_orcado) / nullif(sum(av.custo_orcado),0), 4),
         round(sum(av.pct_planejado * av.custo_orcado) / nullif(sum(av.custo_orcado),0), 4),
         coalesce(bool_or(av.critica = 1 and av.desvio_pp <= -10), false),
         coalesce(jsonb_agg(jsonb_build_object('id', av.id_atividade, 'nome', av.nome_atividade, 'avanco', round(av.avanco,4),
                  'planejado', round(av.pct_planejado,4), 'critica', av.critica) order by av.id_atividade)
                  filter (where av.id_atividade is not null), '[]'::jsonb)
  from public.layout_zonas z left join public.fn_avanco_atividade(p_data) av on av.id_zona = z.id_zona
  group by z.id_zona, z.nome_zona, z.tipo_zona, z.x_m, z.y_m, z.largura_x_m, z.comprimento_y_m, z.altura_m
  order by z.id_zona
$$;

-- ============ R1 · números de controle e R11 · indicadores do dashboard
create or replace function public.fn_controle(p_data date default '2026-11-13')
returns table (indicador text, valor numeric, fonte text)
language sql stable as $$
  select * from (values
    ('Linhas da tabela 15 (mão de obra)', (select count(*)::numeric from public.rdo_mao_de_obra where data <= p_data), 'rdo_mao_de_obra, data <= corte'),
    ('Homens-hora apontados (normais + extras)', (select round(sum(horas_normais + horas_extras),1) from public.rdo_mao_de_obra where data <= p_data), 'rdo_mao_de_obra'),
    ('Custo direto apropriado (R$)', (select round(sum(valor_rs),2) from public.custos_apropriados where categoria <> 'INDIRETO' and data <= p_data), 'custos_apropriados, categoria <> INDIRETO'),
    ('Pedidos de compra emitidos', (select count(*)::numeric from public.compras_pedidos where data_pedido <= p_data), 'compras_pedidos, data_pedido <= corte'),
    ('Lançamentos feitos pelas telas', (select (select count(*) from public.rdo_mao_de_obra where origem='TELA') + (select count(*) from public.rdo_producao where origem='TELA')
       + (select count(*) from public.equip_apontamento where origem='TELA') + (select count(*) from public.custos_apropriados where origem='TELA'))::numeric, 'origem = TELA'),
    ('Integrantes diferentes que lançaram', (select count(distinct lancado_por_email)::numeric from (
        select lancado_por_email from public.rdo_mao_de_obra where origem='TELA' union all select lancado_por_email from public.rdo_producao where origem='TELA'
        union all select lancado_por_email from public.equip_apontamento where origem='TELA' union all select lancado_por_email from public.custos_apropriados where origem='TELA') x), 'lancado_por_email')
  ) t(indicador, valor, fonte)
$$;

create or replace function public.fn_kpis(p_data date default '2026-11-13')
returns jsonb language sql stable as $$
  with t as (select * from public.fn_evm_fase(p_data) where fase = 'TOTAL'),
       w as (select * from public.fn_ppc_semana() where data_inicio <= p_data order by semana desc limit 4),
       h as (select * from public.fn_histograma(p_data - 6, p_data))
  select jsonb_build_object(
    'data', p_data, 'du', public.fn_du(p_data),
    'vp', (select vp from t), 'va', (select va from t), 'cr', (select cr from t), 'idp', (select idp from t), 'idc', (select idc from t),
    'eat', (select eat from t), 'ont', (select orcamento from t), 'avanco_fisico', (select avanco_fisico from t),
    'ppc_ultima', (select ppc from w order by semana desc limit 1), 'ppc_4sem', (select round(sum(concluidos)::numeric/nullif(sum(planejados),0),4) from w),
    'absenteismo_semana', (select round(1 - sum(efetivo_presente)::numeric/nullif(sum(efetivo_escalado),0),4) from h),
    'efetivo_pico_real', (select max(efetivo_presente) from public.fn_histograma('2025-12-01', p_data)),
    'pedidos_abertos_atrasados', (select count(*) from public.fn_pedidos(p_data) where situacao = 'ABERTO_ATRASADO'),
    'restricoes_bloqueando', (select count(*) from public.restricoes where data_identificacao <= p_data and (data_remocao is null or data_remocao > p_data) and data_necessaria < p_data),
    'fvs_reprovacao', (select round(count(*) filter (where resultado='REPROVADO')::numeric/nullif(count(*),0),4) from public.inspecoes_fvs where data <= p_data),
    'hh_retrabalho', (select sum(hh_retrabalho_estimado) from public.inspecoes_fvs where data <= p_data),
    'acidentes', (select count(*) from public.ocorrencias_seguranca where data <= p_data and tipo like 'ACIDENTE%'),
    'adm_local_real', (select sum(valor_rs) from public.custos_apropriados where categoria = 'INDIRETO' and data <= p_data),
    'multa_dia', (select valor::numeric from public.projeto_parametros where parametro = 'multa_atraso_dia_rs'),
    'ganho_dia', (select valor::numeric from public.projeto_parametros where parametro = 'ganho_operacional_dia_rs'),
    'data_contratual', (select valor from public.projeto_parametros where parametro = 'data_contratual_entrega'))
$$;

grant execute on all functions in schema public to anon, authenticated;
