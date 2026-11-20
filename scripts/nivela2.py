import os; exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'cpm.py')).read().split("if __name__")[0])
import numpy as np
ef=A.efetivo.fillna(0).astype(int); LIM=160; END=int(A.EF.max())
topo={a:i for i,a in enumerate(order)}
prio=sorted(A.index,key=lambda a:(A.LS[a],topo[a]))
# garantir ordem com predecessoras antes
done=[];S={};F={}
load=np.zeros(END+60)
pend=list(prio)
while pend:
    for a in pend:
        preds=P[P.id_atividade_sucessora==a]
        if all(p in S for p in preds.id_atividade_predecessora): break
    pend.remove(a)
    e=1
    for _,l in preds.iterrows():
        p=l.id_atividade_predecessora
        e=max(e, F[p]+1+l.defasagem_du if l.tipo_dependencia=='TI' else S[p]+l.defasagem_du)
    d=A.dur[a]; t=e
    while t<=A.LS[a] and (load[t:t+d]+ef[a]>LIM).any(): t+=1
    if t>A.LS[a]: t=e; print('nao coube',a,'e',e,'LS',A.LS[a])
    S[a]=t;F[a]=t+d-1; load[t:t+d]+=ef[a]
print('pico',load.max(),'fim',max(F.values()))
viol=[a for a in A.index if S[a]>A.LS[a]]; print('viol LS',viol)
shift={a:S[a]-int(A.ES[a]) for a in A.index if S[a]!=A.ES[a]}; print(shift)
pd.Series(S).to_csv(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','docs','nivelado.csv'))
