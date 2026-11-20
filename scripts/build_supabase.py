"""Gera os scripts SQL do Supabase (esquema, regras de acesso e carga do histórico) a partir de dados/tratados."""
import os, sys, pandas as pd, numpy as np

REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
D = os.path.join(REPO, 'dados', 'tratados')
OUT = os.path.join(REPO, 'supabase'); os.makedirs(OUT, exist_ok=True)

# nome do arquivo -> (tabela no banco, chave primária ou None para id serial)
MAP = {
    '01_projeto_parametros': ('projeto_parametros', ['parametro']),
    '02_eap': ('eap', ['codigo_eap']),
    '03_atividades': ('atividades', ['id_atividade']),
    '04_dependencias': ('dependencias', ['id_atividade_sucessora', 'id_atividade_predecessora']),
    '05_funcoes_mao_de_obra': ('funcoes', ['funcao']),
    '06_equipamentos': ('equipamentos', ['id_equipamento']),
    '07_atividade_recursos': ('atividade_recursos', ['id_atividade', 'tipo_recurso', 'codigo_recurso']),
    '08_materiais': ('materiais', ['id_material']),
    '09_atividade_materiais': ('atividade_materiais', ['id_atividade', 'id_material']),
    '10_fornecedores': ('fornecedores', ['id_fornecedor']),
    '11_calendario': ('calendario', ['data']),
    '12_orcamento_linha_de_base': ('orcamento', ['id_atividade']),
    '13_layout_zonas': ('layout_zonas', ['id_zona']),
    '14_fluxo_zonas': ('fluxo_zonas', ['id_zona_origem', 'id_zona_destino']),
    '15_rdo_mao_de_obra': ('rdo_mao_de_obra', None),
    '16_rdo_producao': ('rdo_producao', None),
    '17_equipamentos_apontamento': ('equip_apontamento', None),
    '18_compras_pedidos': ('compras_pedidos', ['id_pedido']),
    '19_estoque_movimentos': ('estoque_movimentos', None),
    '20_custos_apropriados': ('custos_apropriados', ['id_lancamento']),
    '21_plano_semanal': ('plano_semanal', ['id_pacote']),
    '22_restricoes': ('restricoes', ['id_restricao']),
    '23_inspecoes_qualidade': ('inspecoes_fvs', ['id_inspecao']),
    '24_ocorrencias_seguranca': ('ocorrencias_seguranca', ['id_ocorrencia']),
    '25_demanda_historica': ('demanda_historica', ['mes', 'familia']),
    '26_processo_postos': ('processo_postos', ['id_posto']),
    '27_producao_apontamento': ('producao_apontamento', ['data', 'turno', 'id_posto']),
    '28_manutencao_os': ('manutencao_os', ['id_os']),
    '29_pontos_logisticos': ('pontos_logisticos', ['id_ponto']),
    '30_localizacao_fatores': ('localizacao_fatores', ['fator']),
    '31_linha_base': ('linha_base', ['id_atividade']),
}
BLOCO_B = {'rdo_mao_de_obra', 'rdo_producao', 'equip_apontamento', 'compras_pedidos', 'estoque_movimentos', 'custos_apropriados',
           'plano_semanal', 'restricoes', 'inspecoes_fvs', 'ocorrencias_seguranca'}
TEXT_FORCE = {'codigo_eap', 'codigo_eap_pai', 'codigo_eap_original', 'semana', 'mes', 'valor', 'id_zona_pai', 'documento'}

# ---- linha de base (D2) como tabela 31
sys.argv = ['x']
_cp = os.path.join(REPO, 'scripts', 'cpm.py'); _ns = {'__file__': _cp}
exec(open(_cp).read().split("if __name__")[0], _ns); A = _ns['A']
niv = pd.read_csv(os.path.join(REPO, 'docs', 'nivelado.csv'), index_col=0).iloc[:, 0]
lb = pd.DataFrame({'id_atividade': A.index, 'efetivo': A.efetivo.fillna(0).astype(int).values, 'duracao_du': A.dur.values,
                   'ic_du': A.ES.values, 'tc_du': A.EF.values, 'it_du': A.LS.values, 'tt_du': A.LF.values,
                   'folga_total_du': A.FT.values, 'critica': (A.FT == 0).astype(int).values,
                   'ic_nivelado_du': [int(niv[a]) for a in A.index]})
lb.to_csv(os.path.join(D, '31_linha_base.csv'), index=False)


def sqltype(col, s):
    if col in TEXT_FORCE: return 'text'
    if col == 'data' or col.startswith('data_'): return 'date'
    if pd.api.types.is_integer_dtype(s): return 'integer'
    if pd.api.types.is_float_dtype(s):
        nn = s.dropna()
        if len(nn) and (nn == nn.round()).all() and col in ('duracao_fixa_du', 'dia_util_projeto', 'turno', 'lote', 'frete_expresso'): return 'integer'
        return 'numeric'
    return 'text'


def lit(v, t):
    if v is None or (isinstance(v, float) and np.isnan(v)) or (isinstance(v, str) and v == ''): return 'null'
    if t in ('integer',): return str(int(float(v)))
    if t == 'numeric': return repr(float(v))
    return "'" + str(v).replace("'", "''") + "'"


schema = ['-- 01_schema.sql · G7 CicloPET Bahia · gerado por scripts/build_supabase.py',
          '-- Rode no Supabase: SQL Editor → New query → cole → Run. Pode rodar de novo: apaga e recria tudo.', '']
seed_parts = {'A': [], 'B': [], 'C': []}
types = {}
for f, (tab, pk) in MAP.items():
    df = pd.read_csv(os.path.join(D, f + '.csv'), dtype={c: str for c in TEXT_FORCE})
    cols = list(df.columns)
    types[tab] = {c: sqltype(c, df[c]) for c in cols}
    defs = []
    if pk is None: defs.append('  id bigserial primary key')
    for c in cols:
        defs.append(f'  {c} {types[tab][c]}')
    if tab in BLOCO_B:
        defs += ["  origem text not null default 'TELA'",
                 '  lancado_por uuid default auth.uid()',
                 "  lancado_por_email text default (auth.jwt() ->> 'email')",
                 '  lancado_em timestamptz not null default now()']
    if pk: defs.append(f'  primary key ({", ".join(pk)})')
    schema.append(f'drop table if exists public.{tab} cascade;')
    schema.append(f'create table public.{tab} (\n' + ',\n'.join(defs) + '\n);')
    # carga
    bloco = 'A' if int(f[:2]) <= 14 or int(f[:2]) == 31 else ('B' if int(f[:2]) <= 24 else 'C')
    extra_c = ['origem'] if tab in BLOCO_B else []
    rows = []
    for r in df.itertuples(index=False):
        vals = [lit(v, types[tab][c]) for c, v in zip(cols, r)] + (["'HISTORICO'"] if extra_c else [])
        rows.append('(' + ','.join(vals) + ')')
    for i in range(0, len(rows), 400):
        seed_parts[bloco].append(f'insert into public.{tab} ({",".join(cols + extra_c)}) values\n' + ',\n'.join(rows[i:i + 400]) + ';')

# índices úteis
schema += ['', 'create index on public.rdo_mao_de_obra (data, id_atividade);', 'create index on public.rdo_producao (data, id_atividade);',
           'create index on public.equip_apontamento (data, id_equipamento);', 'create index on public.custos_apropriados (data, id_atividade);',
           'create index on public.estoque_movimentos (data, id_material);']
# RLS: leitura pública (dashboard aberto), escrita só para usuários logados
schema += ['', '-- Regras de acesso (RLS): qualquer um lê; só integrante logado lança, edita ou apaga']
for f, (tab, pk) in MAP.items():
    schema += [f'alter table public.{tab} enable row level security;',
               f'create policy "{tab}_leitura" on public.{tab} for select to anon, authenticated using (true);',
               f'create policy "{tab}_escrita" on public.{tab} for all to authenticated using (true) with check (true);']
schema += ['', 'grant usage on schema public to anon, authenticated;',
           'grant select on all tables in schema public to anon, authenticated;',
           'grant insert, update, delete on all tables in schema public to authenticated;',
           'grant usage, select on all sequences in schema public to authenticated;']
open(os.path.join(OUT, '01_schema.sql'), 'w').write('\n'.join(schema) + '\n')
names = {'A': '02_carga_bloco_A_planejamento.sql', 'B': '03_carga_bloco_B_execucao.sql', 'C': '04_carga_bloco_C_operacao.sql'}
for k, parts in seed_parts.items():
    head = [f'-- {names[k]} · carga do histórico TRATADO (dados/tratados) até 06/11/2026. Rode depois do 01_schema.sql.',
            '-- A semana de campo (09 a 13/11) NÃO está aqui: deve ser lançada pelas telas do sistema.', 'begin;']
    open(os.path.join(OUT, names[k]), 'w').write('\n'.join(head + parts + ['commit;']) + '\n')
import json
json.dump(types, open(os.path.join(OUT, 'tipos.json'), 'w'), indent=1)
for n in sorted(os.listdir(OUT)):
    print(n, os.path.getsize(os.path.join(OUT, n)) // 1024, 'KB')
