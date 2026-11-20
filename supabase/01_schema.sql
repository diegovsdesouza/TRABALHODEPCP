-- 01_schema.sql · G7 CicloPET Bahia · gerado por scripts/build_supabase.py
-- Rode no Supabase: SQL Editor → New query → cole → Run. Pode rodar de novo: apaga e recria tudo.

drop table if exists public.projeto_parametros cascade;
create table public.projeto_parametros (
  parametro text,
  valor text,
  unidade text,
  descricao text,
  primary key (parametro)
);
drop table if exists public.eap cascade;
create table public.eap (
  codigo_eap text,
  nivel integer,
  codigo_eap_pai text,
  descricao text,
  tipo_item text,
  primary key (codigo_eap)
);
drop table if exists public.atividades cascade;
create table public.atividades (
  id_atividade text,
  codigo_eap text,
  nome_atividade text,
  fase text,
  id_zona text,
  unidade text,
  quantidade_orcada integer,
  rup_orcada_hh_un numeric,
  tipo_duracao text,
  duracao_fixa_du integer,
  regime_execucao text,
  preco_unitario_empreitada_rs numeric,
  encarregado text,
  ambiente text,
  numero_lotes_inspecao integer,
  primary key (id_atividade)
);
drop table if exists public.dependencias cascade;
create table public.dependencias (
  id_atividade_sucessora text,
  id_atividade_predecessora text,
  tipo_dependencia text,
  defasagem_du integer,
  primary key (id_atividade_sucessora, id_atividade_predecessora)
);
drop table if exists public.funcoes cascade;
create table public.funcoes (
  funcao text,
  nome_funcao text,
  custo_hora_rs numeric,
  adicional_hora_extra_pct integer,
  primary key (funcao)
);
drop table if exists public.equipamentos cascade;
create table public.equipamentos (
  id_equipamento text,
  tipo_equipamento text,
  descricao text,
  locadora text,
  ano_fabricacao integer,
  diaria_orcada_rs integer,
  diaria_contratada_rs numeric,
  valor_compra_novo_rs integer,
  custo_manutencao_mensal_proprio_rs integer,
  vida_util_anos integer,
  intervalo_preventiva_h integer,
  primary key (id_equipamento)
);
drop table if exists public.atividade_recursos cascade;
create table public.atividade_recursos (
  id_atividade text,
  tipo_recurso text,
  codigo_recurso text,
  quantidade integer,
  primary key (id_atividade, tipo_recurso, codigo_recurso)
);
drop table if exists public.materiais cascade;
create table public.materiais (
  id_material text,
  descricao text,
  unidade text,
  categoria text,
  preco_orcado_rs numeric,
  lead_time_du integer,
  perda_orcada_pct integer,
  primary key (id_material)
);
drop table if exists public.atividade_materiais cascade;
create table public.atividade_materiais (
  id_atividade text,
  id_material text,
  consumo_por_unidade numeric,
  primary key (id_atividade, id_material)
);
drop table if exists public.fornecedores cascade;
create table public.fornecedores (
  id_fornecedor text,
  nome_fornecedor text,
  cidade text,
  distancia_km integer,
  categorias_atendidas text,
  primary key (id_fornecedor)
);
drop table if exists public.calendario cascade;
create table public.calendario (
  data date,
  dia_semana text,
  dia_util integer,
  feriado text,
  semana text,
  mes text,
  dia_util_projeto integer,
  chuva_mm numeric,
  primary key (data)
);
drop table if exists public.orcamento cascade;
create table public.orcamento (
  id_atividade text,
  codigo_eap text,
  custo_mao_de_obra_rs numeric,
  custo_subcontrato_rs numeric,
  custo_material_rs numeric,
  custo_equipamento_rs integer,
  custo_total_rs numeric,
  primary key (id_atividade)
);
drop table if exists public.layout_zonas cascade;
create table public.layout_zonas (
  id_zona text,
  nome_zona text,
  tipo_zona text,
  id_zona_pai text,
  x_m numeric,
  y_m numeric,
  largura_x_m numeric,
  comprimento_y_m numeric,
  altura_m numeric,
  primary key (id_zona)
);
drop table if exists public.fluxo_zonas cascade;
create table public.fluxo_zonas (
  id_zona_origem text,
  id_zona_destino text,
  viagens_dia integer,
  meio_transporte text,
  carga_media_kg integer,
  primary key (id_zona_origem, id_zona_destino)
);
drop table if exists public.rdo_mao_de_obra cascade;
create table public.rdo_mao_de_obra (
  id bigserial primary key,
  data date,
  id_atividade text,
  funcao text,
  efetivo_previsto integer,
  efetivo_presente integer,
  horas_normais numeric,
  horas_extras integer,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now()
);
drop table if exists public.rdo_producao cascade;
create table public.rdo_producao (
  id bigserial primary key,
  data date,
  id_atividade text,
  quantidade_executada numeric,
  ocorrencia text,
  horas_perdidas_chuva numeric,
  horas_perdidas_equipamento numeric,
  horas_paradas_material numeric,
  hh_retrabalho numeric,
  observacao text,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now()
);
drop table if exists public.equip_apontamento cascade;
create table public.equip_apontamento (
  id bigserial primary key,
  data date,
  id_equipamento text,
  id_atividade text,
  horas_disponiveis integer,
  horas_operando numeric,
  horas_manutencao_corretiva numeric,
  horas_manutencao_preventiva integer,
  horas_ociosas numeric,
  numero_falhas integer,
  horimetro numeric,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now()
);
drop table if exists public.compras_pedidos cascade;
create table public.compras_pedidos (
  id_pedido text,
  id_material text,
  id_atividade text,
  id_fornecedor text,
  comprador text,
  tipo_pedido text,
  data_requisicao date,
  data_pedido date,
  data_necessidade_obra date,
  data_prometida date,
  data_entrega date,
  quantidade_pedida numeric,
  preco_unitario_rs numeric,
  frete_rs numeric,
  frete_expresso integer,
  quantidade_rejeitada_fvm numeric,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now(),
  primary key (id_pedido)
);
drop table if exists public.estoque_movimentos cascade;
create table public.estoque_movimentos (
  id bigserial primary key,
  data date,
  id_material text,
  tipo_movimento text,
  quantidade numeric,
  id_atividade text,
  id_pedido text,
  documento text,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now()
);
drop table if exists public.custos_apropriados cascade;
create table public.custos_apropriados (
  id_lancamento text,
  data date,
  codigo_eap text,
  id_atividade text,
  categoria text,
  valor_rs numeric,
  documento text,
  fornecedor text,
  descricao text,
  codigo_eap_original text,
  regra_reapropriacao text,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now(),
  primary key (id_lancamento)
);
drop table if exists public.plano_semanal cascade;
create table public.plano_semanal (
  id_pacote text,
  semana text,
  data_inicio_semana date,
  id_atividade text,
  encarregado text,
  unidade text,
  meta_quantidade numeric,
  quantidade_realizada numeric,
  concluido integer,
  causa_nao_cumprimento text,
  causa_original text,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now(),
  primary key (id_pacote)
);
drop table if exists public.restricoes cascade;
create table public.restricoes (
  id_restricao text,
  id_atividade text,
  tipo_restricao text,
  responsavel text,
  data_identificacao date,
  data_necessaria date,
  data_remocao date,
  status text,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now(),
  primary key (id_restricao)
);
drop table if exists public.inspecoes_fvs cascade;
create table public.inspecoes_fvs (
  id_inspecao text,
  data date,
  id_atividade text,
  id_zona text,
  lote integer,
  encarregado text,
  itens_verificados integer,
  itens_reprovados integer,
  resultado text,
  hh_retrabalho_estimado numeric,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now(),
  primary key (id_inspecao)
);
drop table if exists public.ocorrencias_seguranca cascade;
create table public.ocorrencias_seguranca (
  id_ocorrencia text,
  data date,
  tipo text,
  id_atividade text,
  funcao_envolvida text,
  dias_perdidos integer,
  houve_hora_extra_no_dia integer,
  chuva_no_dia integer,
  origem text not null default 'TELA',
  lancado_por uuid default auth.uid(),
  lancado_por_email text default (auth.jwt() ->> 'email'),
  lancado_em timestamptz not null default now(),
  primary key (id_ocorrencia)
);
drop table if exists public.demanda_historica cascade;
create table public.demanda_historica (
  mes text,
  familia text,
  unidade text,
  demanda numeric,
  volume_atendido numeric,
  pedidos_no_prazo_pct numeric,
  dias_uteis integer,
  mes_parcial integer,
  primary key (mes, familia)
);
drop table if exists public.processo_postos cascade;
create table public.processo_postos (
  id_posto text,
  sequencia integer,
  nome_posto text,
  id_zona text,
  tempo_ciclo_padrao_s integer,
  recursos_site_atual integer,
  recursos_projeto integer,
  operadores_por_recurso integer,
  disponibilidade_prevista numeric,
  eficiencia_prevista numeric,
  qualidade_prevista numeric,
  investimento_por_recurso_rs integer,
  primary key (id_posto)
);
drop table if exists public.producao_apontamento cascade;
create table public.producao_apontamento (
  data date,
  turno integer,
  id_posto text,
  recursos_ativos integer,
  tempo_programado_min integer,
  parada_planejada_min integer,
  parada_nao_planejada_min integer,
  setup_min integer,
  quantidade_produzida numeric,
  quantidade_refugada numeric,
  operadores_previstos integer,
  operadores_presentes numeric,
  primary key (data, turno, id_posto)
);
drop table if exists public.manutencao_os cascade;
create table public.manutencao_os (
  id_os text,
  data_abertura date,
  id_posto text,
  recurso integer,
  tipo_manutencao text,
  horas_parada numeric,
  hh_manutencao numeric,
  custo_pecas_rs numeric,
  causa text,
  turno integer,
  programada integer,
  primary key (id_os)
);
drop table if exists public.pontos_logisticos cascade;
create table public.pontos_logisticos (
  id_ponto text,
  nome_ponto text,
  tipo_ponto text,
  x_km integer,
  y_km integer,
  volume_t_mes numeric,
  custo_frete_rs_t_km numeric,
  primary key (id_ponto)
);
drop table if exists public.localizacao_fatores cascade;
create table public.localizacao_fatores (
  fator text,
  peso_pct integer,
  nota_terreno_a integer,
  nota_terreno_b integer,
  nota_terreno_c integer,
  primary key (fator)
);
drop table if exists public.linha_base cascade;
create table public.linha_base (
  id_atividade text,
  efetivo integer,
  duracao_du integer,
  ic_du integer,
  tc_du integer,
  it_du integer,
  tt_du integer,
  folga_total_du integer,
  critica integer,
  ic_nivelado_du integer,
  primary key (id_atividade)
);

create index on public.rdo_mao_de_obra (data, id_atividade);
create index on public.rdo_producao (data, id_atividade);
create index on public.equip_apontamento (data, id_equipamento);
create index on public.custos_apropriados (data, id_atividade);
create index on public.estoque_movimentos (data, id_material);

-- Regras de acesso (RLS): qualquer um lê; só integrante logado lança, edita ou apaga
alter table public.projeto_parametros enable row level security;
create policy "projeto_parametros_leitura" on public.projeto_parametros for select to anon, authenticated using (true);
create policy "projeto_parametros_escrita" on public.projeto_parametros for all to authenticated using (true) with check (true);
alter table public.eap enable row level security;
create policy "eap_leitura" on public.eap for select to anon, authenticated using (true);
create policy "eap_escrita" on public.eap for all to authenticated using (true) with check (true);
alter table public.atividades enable row level security;
create policy "atividades_leitura" on public.atividades for select to anon, authenticated using (true);
create policy "atividades_escrita" on public.atividades for all to authenticated using (true) with check (true);
alter table public.dependencias enable row level security;
create policy "dependencias_leitura" on public.dependencias for select to anon, authenticated using (true);
create policy "dependencias_escrita" on public.dependencias for all to authenticated using (true) with check (true);
alter table public.funcoes enable row level security;
create policy "funcoes_leitura" on public.funcoes for select to anon, authenticated using (true);
create policy "funcoes_escrita" on public.funcoes for all to authenticated using (true) with check (true);
alter table public.equipamentos enable row level security;
create policy "equipamentos_leitura" on public.equipamentos for select to anon, authenticated using (true);
create policy "equipamentos_escrita" on public.equipamentos for all to authenticated using (true) with check (true);
alter table public.atividade_recursos enable row level security;
create policy "atividade_recursos_leitura" on public.atividade_recursos for select to anon, authenticated using (true);
create policy "atividade_recursos_escrita" on public.atividade_recursos for all to authenticated using (true) with check (true);
alter table public.materiais enable row level security;
create policy "materiais_leitura" on public.materiais for select to anon, authenticated using (true);
create policy "materiais_escrita" on public.materiais for all to authenticated using (true) with check (true);
alter table public.atividade_materiais enable row level security;
create policy "atividade_materiais_leitura" on public.atividade_materiais for select to anon, authenticated using (true);
create policy "atividade_materiais_escrita" on public.atividade_materiais for all to authenticated using (true) with check (true);
alter table public.fornecedores enable row level security;
create policy "fornecedores_leitura" on public.fornecedores for select to anon, authenticated using (true);
create policy "fornecedores_escrita" on public.fornecedores for all to authenticated using (true) with check (true);
alter table public.calendario enable row level security;
create policy "calendario_leitura" on public.calendario for select to anon, authenticated using (true);
create policy "calendario_escrita" on public.calendario for all to authenticated using (true) with check (true);
alter table public.orcamento enable row level security;
create policy "orcamento_leitura" on public.orcamento for select to anon, authenticated using (true);
create policy "orcamento_escrita" on public.orcamento for all to authenticated using (true) with check (true);
alter table public.layout_zonas enable row level security;
create policy "layout_zonas_leitura" on public.layout_zonas for select to anon, authenticated using (true);
create policy "layout_zonas_escrita" on public.layout_zonas for all to authenticated using (true) with check (true);
alter table public.fluxo_zonas enable row level security;
create policy "fluxo_zonas_leitura" on public.fluxo_zonas for select to anon, authenticated using (true);
create policy "fluxo_zonas_escrita" on public.fluxo_zonas for all to authenticated using (true) with check (true);
alter table public.rdo_mao_de_obra enable row level security;
create policy "rdo_mao_de_obra_leitura" on public.rdo_mao_de_obra for select to anon, authenticated using (true);
create policy "rdo_mao_de_obra_escrita" on public.rdo_mao_de_obra for all to authenticated using (true) with check (true);
alter table public.rdo_producao enable row level security;
create policy "rdo_producao_leitura" on public.rdo_producao for select to anon, authenticated using (true);
create policy "rdo_producao_escrita" on public.rdo_producao for all to authenticated using (true) with check (true);
alter table public.equip_apontamento enable row level security;
create policy "equip_apontamento_leitura" on public.equip_apontamento for select to anon, authenticated using (true);
create policy "equip_apontamento_escrita" on public.equip_apontamento for all to authenticated using (true) with check (true);
alter table public.compras_pedidos enable row level security;
create policy "compras_pedidos_leitura" on public.compras_pedidos for select to anon, authenticated using (true);
create policy "compras_pedidos_escrita" on public.compras_pedidos for all to authenticated using (true) with check (true);
alter table public.estoque_movimentos enable row level security;
create policy "estoque_movimentos_leitura" on public.estoque_movimentos for select to anon, authenticated using (true);
create policy "estoque_movimentos_escrita" on public.estoque_movimentos for all to authenticated using (true) with check (true);
alter table public.custos_apropriados enable row level security;
create policy "custos_apropriados_leitura" on public.custos_apropriados for select to anon, authenticated using (true);
create policy "custos_apropriados_escrita" on public.custos_apropriados for all to authenticated using (true) with check (true);
alter table public.plano_semanal enable row level security;
create policy "plano_semanal_leitura" on public.plano_semanal for select to anon, authenticated using (true);
create policy "plano_semanal_escrita" on public.plano_semanal for all to authenticated using (true) with check (true);
alter table public.restricoes enable row level security;
create policy "restricoes_leitura" on public.restricoes for select to anon, authenticated using (true);
create policy "restricoes_escrita" on public.restricoes for all to authenticated using (true) with check (true);
alter table public.inspecoes_fvs enable row level security;
create policy "inspecoes_fvs_leitura" on public.inspecoes_fvs for select to anon, authenticated using (true);
create policy "inspecoes_fvs_escrita" on public.inspecoes_fvs for all to authenticated using (true) with check (true);
alter table public.ocorrencias_seguranca enable row level security;
create policy "ocorrencias_seguranca_leitura" on public.ocorrencias_seguranca for select to anon, authenticated using (true);
create policy "ocorrencias_seguranca_escrita" on public.ocorrencias_seguranca for all to authenticated using (true) with check (true);
alter table public.demanda_historica enable row level security;
create policy "demanda_historica_leitura" on public.demanda_historica for select to anon, authenticated using (true);
create policy "demanda_historica_escrita" on public.demanda_historica for all to authenticated using (true) with check (true);
alter table public.processo_postos enable row level security;
create policy "processo_postos_leitura" on public.processo_postos for select to anon, authenticated using (true);
create policy "processo_postos_escrita" on public.processo_postos for all to authenticated using (true) with check (true);
alter table public.producao_apontamento enable row level security;
create policy "producao_apontamento_leitura" on public.producao_apontamento for select to anon, authenticated using (true);
create policy "producao_apontamento_escrita" on public.producao_apontamento for all to authenticated using (true) with check (true);
alter table public.manutencao_os enable row level security;
create policy "manutencao_os_leitura" on public.manutencao_os for select to anon, authenticated using (true);
create policy "manutencao_os_escrita" on public.manutencao_os for all to authenticated using (true) with check (true);
alter table public.pontos_logisticos enable row level security;
create policy "pontos_logisticos_leitura" on public.pontos_logisticos for select to anon, authenticated using (true);
create policy "pontos_logisticos_escrita" on public.pontos_logisticos for all to authenticated using (true) with check (true);
alter table public.localizacao_fatores enable row level security;
create policy "localizacao_fatores_leitura" on public.localizacao_fatores for select to anon, authenticated using (true);
create policy "localizacao_fatores_escrita" on public.localizacao_fatores for all to authenticated using (true) with check (true);
alter table public.linha_base enable row level security;
create policy "linha_base_leitura" on public.linha_base for select to anon, authenticated using (true);
create policy "linha_base_escrita" on public.linha_base for all to authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
