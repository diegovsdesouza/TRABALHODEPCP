"""
ENG037 · Trabalho Final · G7 CicloPET Bahia
Tratamento de qualidade dos dados (Bloco B e C) — versão 1 (18/11/2026)

Uso:  python tratamento_dados.py <arquivo.xlsx> <pasta_saida>
Saída: <pasta_saida>/dados_tratados/*.csv  +  <pasta_saida>/log_tratamento.csv

Regras: nada é apagado em silêncio. Toda linha alterada ou removida vai para o log
com tabela, chave, valor original, valor novo e regra aplicada.
"""
import sys, os, unicodedata
import pandas as pd

XLSX = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(os.path.join(OUT, 'dados_tratados'), exist_ok=True)

X = pd.ExcelFile(XLSX)
T = {s: X.parse(s) for s in X.sheet_names if s[:2].isdigit()}
LOG = []


def log(tabela, chave, campo, original, novo, regra):
    LOG.append(dict(tabela=tabela, chave=chave, campo=campo,
                    valor_original=original, valor_novo=novo, regra=regra))


A = T['03_atividades'].set_index('id_atividade')

# ---------------------------------------------------------------- Q1
# 15_rdo_mao_de_obra: linhas 100% duplicadas (mesma data, atividade, função e valores).
# Confirmação: a folha semanal (20_custos, documento FOLHA) bate com o RDO SEM as duplicatas
# nas 7 semanas afetadas -> a duplicata é erro de digitação do RDO, não trabalho real.
t = T['15_rdo_mao_de_obra']
dup = t[t.duplicated()]
for _, r in dup.iterrows():
    log('15_rdo_mao_de_obra', f"{r.data}|{r.id_atividade}|{r.funcao}", 'linha inteira',
        f"HN={r.horas_normais}; HE={r.horas_extras}", 'REMOVIDA',
        'Q1 duplicata exata; folha semanal confirma valor sem duplicata')
T['15_rdo_mao_de_obra'] = t.drop_duplicates().reset_index(drop=True)

# ---------------------------------------------------------------- Q2
# 16_rdo_producao: vírgula decimal deslocada (valor 10x maior que o normal).
# Detecção: quantidade > 4x a mediana diária da atividade E valor/10 dentro de 0,5x–1,5x da mediana.
# Confirmação: após a correção, A13 e A15 somam exatamente a quantidade orçada.
t = T['16_rdo_producao']
med = t.groupby('id_atividade').quantidade_executada.transform('median')
alvo = (t.quantidade_executada > 4 * med) & (med > 0) & \
       ((t.quantidade_executada / 10).between(0.5 * med, 1.5 * med))
for i in t[alvo].index:
    v = t.at[i, 'quantidade_executada']
    log('16_rdo_producao', f"{t.at[i,'data']}|{t.at[i,'id_atividade']}", 'quantidade_executada',
        v, round(v / 10, 3), 'Q2 casa decimal deslocada (x10); corrigido para valor/10')
    t.at[i, 'quantidade_executada'] = round(v / 10, 3)
T['16_rdo_producao'] = t

# ---------------------------------------------------------------- Q3
# 20_custos_apropriados: lançamentos 'DIVERSOS' (sem apropriação). Reapropriação por evidência:
#   RM-Axx-...  -> atividade escrita no próprio documento
#   FOLHA-...   -> nome da atividade no histórico do lançamento
#   LOC/MOB-... -> atividade em que o equipamento operou naquela semana (tabela 17)
#   equipamento ocioso a semana toda -> próxima atividade atendida pelo equipamento
t = T['20_custos_apropriados']
e = T['17_equipamentos_apontamento'].copy()
e['data'] = pd.to_datetime(e.data)
ic = e.data.dt.isocalendar()
e['semana'] = ic.year.astype(str) + '-S' + ic.week.astype(str).str.zfill(2)
t['codigo_eap_original'] = t.codigo_eap
t['regra_reapropriacao'] = ''
for i, r in t[t.codigo_eap == 'DIVERSOS'].iterrows():
    doc = r.documento
    p = doc.split('-')
    if p[0] == 'RM':
        at, regra = p[1], 'Q3a atividade no código da RM'
    elif p[0] == 'FOLHA':
        nome = r.descricao.split(': ', 1)[1]
        at, regra = A.index[A.nome_atividade == nome][0], 'Q3b nome da atividade no histórico'
    else:
        eq = p[1] + '-' + p[2]
        if p[0] == 'LOC':
            g = e[(e.id_equipamento == eq) & (e.semana == p[3] + '-' + p[4])]
        else:
            ini = pd.to_datetime('20' + p[3], format='%Y%m%d')
            g = e[(e.id_equipamento == eq) & (e.data >= ini)].sort_values('data').head(5)
        h = g.dropna(subset=['id_atividade']).groupby('id_atividade').horas_operando.sum()
        if len(h):
            # se o documento já tem parte apropriada a uma atividade, o resto vai para a outra
            ja = set(t[(t.documento == doc) & (t.codigo_eap != 'DIVERSOS')].id_atividade)
            resto = h.drop(labels=[x for x in ja if x in h.index], errors='ignore')
            at = (resto if len(resto) else h).idxmax()
            regra = 'Q3c atividade atendida pelo equipamento na semana (tabela 17)'
        else:
            prox = e[(e.id_equipamento == eq) & (e.data > pd.to_datetime(r.data)) & e.id_atividade.notna()]
            at = prox.sort_values('data').id_atividade.iloc[0]
            regra = 'Q3d equipamento ocioso na semana; apropriado à próxima atividade atendida (custo de ociosidade)'
    log('20_custos_apropriados', r.id_lancamento, 'codigo_eap/id_atividade', 'DIVERSOS/vazio',
        f"{A.at[at,'codigo_eap']}/{at}", regra)
    t.at[i, 'codigo_eap'] = A.at[at, 'codigo_eap']
    t.at[i, 'id_atividade'] = at
    t.at[i, 'regra_reapropriacao'] = regra
T['20_custos_apropriados'] = t

# ---------------------------------------------------------------- Q4
# 21_plano_semanal: causas digitadas à mão com variações de grafia -> domínio padronizado.
DOM = {'MATERIAL', 'CHUVA', 'MAO_DE_OBRA', 'EQUIPAMENTO', 'PROJETO', 'SERVICO_ANTERIOR',
       'RETRABALHO', 'PRODUTIVIDADE', 'LICENCA', 'TERCEIROS'}


def padroniza(x):
    if pd.isna(x):
        return x
    s = unicodedata.normalize('NFKD', str(x)).encode('ascii', 'ignore').decode()
    return s.strip().upper().replace(' ', '_').replace('-', '_')


t = T['21_plano_semanal']
t['causa_original'] = t.causa_nao_cumprimento
novo = t.causa_nao_cumprimento.map(padroniza)
for i in t[(novo != t.causa_nao_cumprimento) & t.causa_nao_cumprimento.notna()].index:
    log('21_plano_semanal', t.at[i, 'id_pacote'], 'causa_nao_cumprimento',
        t.at[i, 'causa_nao_cumprimento'], novo[i], 'Q4 grafia padronizada (maiúsculas, sem acento, _)')
t['causa_nao_cumprimento'] = novo
assert set(novo.dropna()) <= DOM, set(novo.dropna()) - DOM
T['21_plano_semanal'] = t

# ---------------------------------------------------------------- Q5
# 27_producao_apontamento: posto produziu com 'operadores_presentes = 0' (impossível).
# Tratado como lacuna de apontamento: vira vazio e sai do cálculo de absenteísmo; OEE não muda.
t = T['27_producao_apontamento']
m = (t.operadores_presentes == 0) & (t.quantidade_produzida > 0)
for i in t[m].index:
    log('27_producao_apontamento', f"{t.at[i,'data']}|T{t.at[i,'turno']}|{t.at[i,'id_posto']}",
        'operadores_presentes', 0, 'vazio', 'Q5 produção sem operador: lacuna de apontamento')
t['operadores_presentes'] = t.operadores_presentes.astype('float')
t.loc[m, 'operadores_presentes'] = float('nan')
T['27_producao_apontamento'] = t

# ---------------------------------------------------------------- Q6
# 25_demanda_historica: mês 2026-11 aparece fechado, mas o histórico vai até 06/11/2026.
# Marcado como parcial/projetado; não entra em médias e tendências.
t = T['25_demanda_historica']
t['mes_parcial'] = (t.mes == '2026-11').astype(int)
for i in t[t.mes_parcial == 1].index:
    log('25_demanda_historica', f"{t.at[i,'mes']}|{t.at[i,'familia']}", 'mes_parcial', 0, 1,
        'Q6 mês não encerrado na data de corte; excluir de médias')
T['25_demanda_historica'] = t

# ---------------------------------------------------------------- saída
for s, d in T.items():
    d.to_csv(os.path.join(OUT, 'dados_tratados', f'{s}.csv'), index=False, encoding='utf-8')
pd.DataFrame(LOG).to_csv(os.path.join(OUT, 'log_tratamento.csv'), index=False, encoding='utf-8')

# números de conferência
p = T['16_rdo_producao']
av = (p.groupby('id_atividade').quantidade_executada.sum() / A.quantidade_orcada).clip(upper=1)
print('alterações registradas:', len(LOG))
print(pd.DataFrame(LOG).groupby('regra').size().to_string())
print('A13 soma:', round(p[p.id_atividade == 'A13'].quantidade_executada.sum(), 3),
      '| A15 soma:', round(p[p.id_atividade == 'A15'].quantidade_executada.sum(), 3))
print('DIVERSOS restantes:', (T['20_custos_apropriados'].codigo_eap == 'DIVERSOS').sum())
