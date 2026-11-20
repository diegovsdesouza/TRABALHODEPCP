# Qualidade dos dados — G7 CicloPET Bahia

**Responsável:** [nome] · **Versão:** 1 · **Data:** 18/11/2026
**Fonte:** `G7 - Base de dados - CicloPET Bahia.xlsx`, abas 01 a 30 · **Script:** `scripts/tratamento_dados.py` · **Log linha a linha:** `docs/log_tratamento.csv`

## 1. Resumo

- Foram verificadas as 30 tabelas (8.150 linhas). Os testes cobriram chaves duplicadas, integridade entre tabelas, domínios, datas fora do calendário, valores negativos, outliers, coerência entre colunas e reconciliação cruzada entre tabelas.
- O Bloco A (planejamento) está íntegro:
  - a soma da tabela 12 bate com o parâmetro `orcamento_custo_direto_rs` (R$ 33.879.987,75);
  - todo pacote da EAP tem atividade (regra dos 100%);
  - a rede não tem ciclos;
  - o calendário tem 455 du sequenciais e 24 feriados.
- Os problemas estão nos Blocos B e C. São **6 tipos de problema** e **57 alterações** registradas. Nenhuma linha foi apagada sem registro.

| Cód. | Tabela | Problema | Linhas | Tratamento | Como foi confirmado |
|---|---|---|---|---|---|
| Q1 | 15_rdo_mao_de_obra | Linhas duplicadas por inteiro (mesma data, atividade e função) | 7 | Removidas | A folha semanal (20_custos, FOLHA) bate com o RDO **sem** as duplicatas em 7/7 semanas. Com elas, o RDO ficaria R$ 12.525 acima da folha |
| Q2 | 16_rdo_producao | Casa decimal deslocada (valor 10× maior): A13 em 04/09 (2.431,07 m²), A15 em 31/08 (785,86 m²), A24 em 27/10 (5,40 un) | 3 | Dividido por 10 | Depois da correção, A13 soma 9.000 m² e A15 soma 2.560 m², exatamente a quantidade orçada. Antes, os avanços seriam de 124% e 128%. O Hh do dia é normal (192 e 120 Hh) |
| Q3 | 20_custos_apropriados | Lançamentos `DIVERSOS`, sem item da EAP | 26 (R$ 1.737.391,91) | Reapropriados por evidência: código da RM (9), nome no histórico da FOLHA (3), atividade atendida pelo equipamento na semana, conforme a tabela 17 (13), e próxima atividade atendida, para equipamento ocioso (1) | Nenhum DIVERSOS restante. Os R$ 1,32 mi da estrutura metálica (RM-A09-EMT, S28 e S29) vão para A09 |
| Q4 | 21_plano_semanal | Causa de não cumprimento digitada à mão com várias grafias ("serviço anterior", "Servico_anterior", "mão de obra"...) | 13 | Padronizada: maiúsculas, sem acento, com `_` | Todas as causas caem nas 10 categorias do dicionário |
| Q5 | 27_producao_apontamento | PT05 produziu com `operadores_presentes = 0` | 5 | Campo esvaziado (lacuna) e retirado do cálculo de absenteísmo | O OEE não depende do campo |
| Q6 | 25_demanda_historica | O mês 2026-11 aparece fechado, mas o histórico termina em 06/11 | 3 | Marcado como `mes_parcial = 1` e excluído de médias e tendências | — |

## 2. Itens verificados que **não** são erro (premissas declaradas)

| Tabela | O que parece erro | Por que foi mantido |
|---|---|---|
| 15 | 34 linhas com `horas_normais` < presentes × 8 h | Todas ficam no **último dia** da atividade: meio expediente de fechamento |
| 16 | Somas como 420,001 ou 100,004 | Arredondamento; o avanço é limitado a 100% (Anexo D) |
| 17 | Horímetro difere das horas operando em ±0,1 h (254 linhas) | Arredondamento do horímetro |
| 17 | 22 dias com hora de corretiva e 0 falhas | Reparo que continua do dia anterior. A falha é contada uma vez só, o que está correto para o MTBF/MTTR |
| 20 | Mesmo documento LOC em 2 a 3 linhas | Rateio de uma locação entre atividades da mesma semana |
| 20 | Lançamentos em dia que não é sexta | Mobilizações (data do evento) e semanas com feriado na sexta |
| 21 | Encarregado "Coordenação do projeto" nas atividades contratadas | Atividades sem equipe no canteiro (cadastro vazio, conforme o dicionário) |
| 25 | Pellet em 2026-10 = 787 t (+16% sobre set.) | Coerente com a tendência de alta. Mantido, mas é sinal de demanda acima da capacidade (volume atendido de 706,8 t) |

## 3. Números de controle após o tratamento (corte 06/11/2026)

| Indicador | Valor | Fonte e filtro |
|---|---|---|
| CR direto acumulado | R$ 25.027.069,69 | 20_custos, categoria ≠ INDIRETO, data ≤ 06/11 |
| Administração local realizada | R$ 1.988.458,16 | 20_custos, categoria = INDIRETO |
| VA acumulado | R$ 22.269.563,69 (65,7% do ONT) | 16 tratada × 12; avanço limitado a 100% |
| Atividades: concluídas / em andamento / não iniciadas | 22 / 6 / 11 | 16 tratada |
| PPC acumulado | 65,8% (meta 80%), com 219 pacotes | 21 tratada, `concluido` |
| Absenteísmo | 4,88% | 15 tratada, 1 − Σpresente ÷ Σprevisto |
| Pico de efetivo | **173 pessoas em 15/09/2026** (limite do canteiro: 160) | 15 tratada, Σ efetivo_presente por dia |

> O VP e o IDP dependem da linha de base (D2) e serão calculados na próxima etapa.

## 4. Impacto, se não tivesse tratado

- **Avanço de A13 e A15** em 124% e 128%: o VA ficaria inflado e as duas atividades pareceriam adiantadas.
- **R$ 1,74 mi de custo fora das atividades**: o IDC de A09 (estrutura metálica) e de A17 (subestação) ficaria otimista, e o CR por fase não fecharia com o total.
- **Hh e RUP real de A08, A12, A14, A17 e A27** superestimados pelas duplicatas.
- **Pareto de causas** fragmentado: "SERVICO_ANTERIOR" apareceria dividido em 4 barras, quando é a causa nº 1, com 22 dos 75 pacotes não cumpridos.
