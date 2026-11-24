# Diário de prompts

> Regra do enunciado: **mínimo de 10 entradas, de pelo menos 4 integrantes diferentes**. Registre, por data, os pedidos mais importantes feitos à IA, o que ela errou e como o grupo conferiu e corrigiu.
> As entradas abaixo são **rascunhos** da sessão de 18/11/2026. Cada integrante deve revisar, assumir a autoria da que conduziu e escrever com as próprias palavras.

| # | Data | Integrante | Pedido à IA (resumo) | O que a IA errou ou poderia errar | Como conferimos e corrigimos |
|---|---|---|---|---|---|
| 1 | 18/11/2026 | Diego | Varredura de qualidade nas 30 tabelas | Poderia tratar como erro os dias com Hh normais < presentes × 8 h | Conferimos que os 34 casos são o último dia de cada atividade (meio expediente): mantidos e documentados |
| 2 | 18/11/2026 | Diego | Confirmar as duplicatas da tabela 15 | Remover sem prova | Cruzamos com a folha semanal (tabela 20, FOLHA): só fecha sem as 7 duplicatas |
| 3 | 18/11/2026 | Diego | Detectar valores absurdos na produção (tabela 16) | — | Três valores 10× maiores; após dividir por 10, A13 e A15 somam exatamente a quantidade orçada |
| 4 | 18/11/2026 | Diego | Calcular a rede e o caminho crítico (D2) | A data contratual em du saiu 289 em vez de 288 (usou a linha da planilha, não o du) | Trocamos CORRESP por ÍNDICE/CORRESP na coluna du; o resultado bateu com o cálculo em Python |
| 5 | 18/11/2026 | Diego | Nivelar o histograma (D4) | A primeira heurística, que empurrava atividades dia a dia, piorou o pico (241 pessoas) | Trocamos por programação serial por prioridade de menor IT: pico de 160 sem mudar o prazo |
| 6 | 18/11/2026 | Diego | Projeção de demanda (D9) | O índice do mês projetou jul/2027 em vez de mar/2027 | Conferimos contra a tendência calculada à parte (1.448 t/mês) e corrigimos a fórmula |
| 7 | 18/11/2026 | Diego | Conferir os números de controle do dossiê | — | 6 de 6 batem, inclusive os de 13/11, somados a partir dos boletins |
| 8 | 22/11/2026 | Ingrid | Organizar os lançamentos de custos da semana do L00829 ao L00844| A IA poderia classificar incorretamente a natureza dos custos ou associar valores às atividades erradas | Conferimos os lançamentos com os documentos e verificamos a correspondência entre atividade, natureza e valor |
| 9 | 22/11/2026 | Ingrid | Apoiar a conferência final do plano semanal (6/6). | A IA poderia considerar uma atividade parcialmente realizada como concluída ou deixar de registrar uma causa do não cumprimento da meta| Conferimos o realizado em relação ao planejado e verificamos as justificativas das atividades não concluídas |
| 10 | 23/11/2026 | Bruno | Lançar no sistema o B8 (FVS e restrições) e os custos L00813 a L00828 | A IA poderia criar a R057 de novo em vez de atualizar a existente, ou lançar valor com ponto de milhar errado | Usamos "Carregar" para atualizar R057 e R069, conferimos cada custo com o documento e a Conferência fechou 6 de 6 |
| 11 | 22/11/2026 | Diego | Diagnóstico em 13/11 e refazer os cenários com a semana de campo | Usar o avanço até 06/11 e ignorar a semana de campo | Recalculamos a rede com o avanço do sistema em 13/11: o cenário S1 deu 01/04/2027, igual à página Prazo |
| 12 | 23/11/2026 | Larissa | Montar a folha M2 (histograma e nivelamento) | A IA poderia nivelar movendo uma atividade crítica e mudar o prazo | Conferimos que só a A27 (folga de 26 du) foi deslocada: o pico caiu de 161 para 125 pessoas e o prazo continuou em 71 du |
