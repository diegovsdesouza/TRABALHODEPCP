import pandas as pd, math, numpy as np
import os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','dados','tratados','')
A=pd.read_csv(D+'03_atividades.csv').set_index('id_atividade'); P=pd.read_csv(D+'04_dependencias.csv'); LB=pd.read_csv(D+'31_linha_base.csv').set_index('id_atividade')
C=pd.read_csv(D+'11_calendario.csv'); cal=C.dropna(subset=['dia_util_projeto']).set_index('dia_util_projeto').data
import sys
AV=sys.argv[1] if len(sys.argv)>1 else D+'32_avanco_1311.csv'  # avanço por atividade em 13/11 (fn_avanco_atividade)
av=pd.read_csv(AV).set_index('id_atividade').avanco.astype(float)
S=int(C[C.data=='2026-11-13'].dia_util_projeto.iloc[0])  # status du 237
CONTR=288; LBEND=278; MULTA=22100; GANHO=37300
def rede(fator=None, lags=None, ini_extra=None):
    fator=fator or {}; lags=lags or {}
    dur={}; ini={}
    for a in A.index:
        d0=int(LB.duracao_du[a]); x=av.get(a,0)
        if x>=0.999: dur[a]=1; ini[a]=1; continue
        rest=max(1, math.ceil(d0*(1-x))); dur[a]=max(1, math.ceil(rest*fator.get(a,1))); ini[a]=S+1
    order=list(LB.sort_values('ic_du').index); ES={a:ini[a] for a in A.index}; EF={a:ES[a]+dur[a]-1 for a in A.index}
    for _ in range(60):
        ch=False
        for r in P.itertuples():
            s,pr=r.id_atividade_sucessora,r.id_atividade_predecessora; lag=lags.get((pr,s),r.defasagem_du)
            if av.get(s,0)>=0.999: continue
            v=EF[pr]+1+lag if r.tipo_dependencia=='TI' else ES[pr]+lag
            if v>ES[s]: ES[s]=v; EF[s]=v+dur[s]-1; ch=True
        if not ch: break
    fim=max(EF[a] for a in A.index if av.get(a,0)<0.999)
    return fim, dur
base,_=rede(); print('S1 seguir: fim du',base,cal[base],'atraso contrato',base-CONTR,'multa',(base-CONTR)*MULTA,'ganho perdido vs LB',(base-LBEND)*GANHO)
# S2 recuperar: HE 2h/dia na cadeia crítica (A25,A26,A30,A35) -> fator 8/10/1.0 com perda de 10% de produtividade => 0.8/0.9=0.889 ; reforço A30 +50% equipe (perda 10%) => fator /1.5*1.1
f2={'A25':0.889,'A26':0.889,'A35':0.889,'A30':(1/1.5)*1.1*0.889}
fim2,d2=rede(f2); print('S2 recuperar: fim',fim2,cal[fim2],'atraso',fim2-CONTR, 'dur', {k:d2[k] for k in f2})
# S3 replanejar: reduzir defasagens II (montagem por módulos) A25->A26 8->5, A26->A30 8->5, A21->A30 5->3 ; HE só em A30 (0.889)
lags3={('A25','A26'):5,('A26','A30'):5}
fim3,d3=rede({'A30':0.889},lags3); print('S3 replanejar: fim',fim3,cal[fim3],'atraso',fim3-CONTR)
# custos
F=pd.read_csv(D+'05_funcoes_mao_de_obra.csv').set_index('funcao'); R=pd.read_csv(D+'07_atividade_recursos.csv'); mo=R[R.tipo_recurso=='MAO_DE_OBRA']
def custo_dia(a): g=mo[mo.id_atividade==a]; return float((g.quantidade*g.codigo_recurso.map(F.custo_hora_rs)).sum())
def ef(a): return int(mo[mo.id_atividade==a].quantidade.sum())
# custo HE: horas extras 2h/pessoa/dia × custo_hora × 1,6 ao longo da nova duração ; perda de produtividade já embutida
he=lambda a,dd: custo_dia(a)*2*1.6*dd
c2=sum(he(a,d2[a]) for a in ['A25','A26','A35']) + he('A30',d2['A30'])*1.5 + 0.1*custo_dia('A30')*8*d2['A30']*1.5  # HE + ineficiência do reforço
mob=20000  # mobilização/treinamento de 12 montadores extras (premissa)
print('S2 custo HE+reforço', round(c2), '+mob', mob, ' pico efetivo A30 reforçado', ef('A30')*1.5)
c3=he('A30',d3['A30'])+60000  # engenharia de montagem por módulos + MUN extra (premissa)
print('S3 custo', round(c3))
for nome,fim,c in [('S1',base,0),('S2',fim2,c2+mob),('S3',fim3,c3)]:
    atr=max(0,fim-CONTR); mult=atr*MULTA; gp=max(0,fim-LBEND)*GANHO
    print(nome,'fim',cal[fim],'atraso',atr,'multa',mult,'ganho perdido',gp,'custo adic',round(c),'total',round(c+mult+gp), 'multa evitada', (base-CONTR)*MULTA-mult)
fim4,d4=rede(f2,lags3); c4=c2+mob+60000
atr=fim4-CONTR; print('S4 combinado fim',cal[fim4],'atraso',atr,'multa',atr*MULTA,'ganho perdido',(fim4-LBEND)*GANHO,'custo',round(c4),'total',round(c4+atr*MULTA+(fim4-LBEND)*GANHO))
# o que ainda sobra no caminho: A35->A37->A38 contratados fixos
print('resto da cadeia após A30: A35',d4['A35'],'A37 15 A38 20')
