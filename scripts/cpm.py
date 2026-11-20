import pandas as pd, math, sys
import os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','dados','tratados','')
A=pd.read_csv(D+'03_atividades.csv').set_index('id_atividade')
R=pd.read_csv(D+'07_atividade_recursos.csv'); P=pd.read_csv(D+'04_dependencias.csv'); C=pd.read_csv(D+'11_calendario.csv'); O=pd.read_csv(D+'12_orcamento_linha_de_base.csv').set_index('id_atividade')
ef=R[R.tipo_recurso=='MAO_DE_OBRA'].groupby('id_atividade').quantidade.sum()
A['efetivo']=ef; 
A['dur']=[int(r.duracao_fixa_du) if r.tipo_duracao=='FIXA' else math.ceil(r.quantidade_orcada*r.rup_orcada_hh_un/(r.efetivo*8)-1e-9) for _,r in A.iterrows()]
import networkx as nx
G=nx.DiGraph(); G.add_nodes_from(A.index); G.add_edges_from(zip(P.id_atividade_predecessora,P.id_atividade_sucessora)); order=list(nx.topological_sort(G))
ES={};EF={}
for a in order:
    s=1
    for _,l in P[P.id_atividade_sucessora==a].iterrows():
        p=l.id_atividade_predecessora
        s=max(s, EF[p]+1+l.defasagem_du if l.tipo_dependencia=='TI' else ES[p]+l.defasagem_du)
    ES[a]=s; EF[a]=s+A.dur[a]-1
END=max(EF.values()); LS={};LF={}
for a in reversed(order):
    f=END
    for _,l in P[P.id_atividade_predecessora==a].iterrows():
        s=l.id_atividade_sucessora
        f=min(f, LS[s]-1-l.defasagem_du if l.tipo_dependencia=='TI' else LS[s]-l.defasagem_du+A.dur[a]-1)
    LF[a]=f; LS[a]=f-A.dur[a]+1
A['ES']=pd.Series(ES);A['EF']=pd.Series(EF);A['LS']=pd.Series(LS);A['LF']=pd.Series(LF);A['FT']=A.LS-A.ES
cal=C.dropna(subset=['dia_util_projeto']).set_index('dia_util_projeto').data
A['ini']=A.ES.map(cal);A['fim']=A.EF.map(cal)
A['custo']=O.custo_total_rs
if __name__=='__main__':
    pd.set_option('display.width',250)
    print(A[['nome_atividade','tipo_duracao','efetivo','dur','ES','EF','LS','LF','FT','ini','fim']].to_string())
    print('FIM du',END, cal[END], ' contrato', C[C.data=='2027-01-28'].dia_util_projeto.values)
    print('criticas', list(A[A.FT==0].index)); print('quase', A[(A.FT>0)&(A.FT<=5)].FT.to_dict())
    print('ordem topo', order)
