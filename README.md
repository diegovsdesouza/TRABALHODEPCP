# Comitê de PCP: G7 CicloPET Bahia

Trabalho final de **ENG037 · Planejamento e Controle da Produção** (UFBA, 2026.2, Prof. Lucas Magalhães).
O grupo atua como time de PCP da implantação da **planta de reciclagem de PET (do fardo ao pellet)** em Feira de Santana.

- **Data de status:** 13/11/2026 · **Entrega digital:** 24/11/2026
- **Sistema publicado:** https://diegovsdesouza.github.io/TRABALHODEPCP/app/
- **Integrantes:**

| Integrante | GitHub | Papel principal |
|---|---|---|
| Diego Santana de Souza | [@diegovsdesouza](https://github.com/diegovsdesouza) | Coordenação, prazo e caminho crítico (D1–D3, M1), cenários e plano de ação |
| Mirella França | [@azura856](https://github.com/azura856) | Estrutura do repositório e do banco, valor agregado e PPC (M4) |
| Larissa Livramento | [@Larbst1234](https://github.com/Larbst1234) | Histograma e nivelamento (D4, M2), PPC e produtividade |
| Carlos | [@carlos-santos123](https://github.com/carlos-santos123) | Operação, capacidade e OEE (D9, M3), localização e layout |
| Bruno | [@brunoanna-cell](https://github.com/brunoanna-cell) | Suprimentos, equipamentos e qualidade (D5, D7, M5) |
| Ingrid | [@amorisenna](https://github.com/amorisenna) | Sistema, dados e conferência, custos e fechamento da semana, cenários (M6) |

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `docs/` | Documentos D1 a D12, qualidade dos dados, diário de prompts e cópia escaneada do caderno manuscrito (`docs/caderno/`) |
| `docs/planilhas/` | Planilhas LibreOffice (.ods) com fórmulas vivas: D1/D2, **D3 (Gantt)**, D4/D6, D5/D10, D8/D9 |
| `dados/brutos/` | As 30 tabelas originais do pacote do G7 |
| `dados/tratados/` | As mesmas tabelas após o tratamento (ver `docs/qualidade-dos-dados.md`) |
| `scripts/` | `tratamento_dados.py` (limpeza), `cpm.py` (rede e caminho crítico), `nivela2.py` (nivelamento de recursos), `cenarios.py` (três cenários em 13/11) |
| `app/` | Sistema web de acompanhamento (Parte 2): HTML + JavaScript, sem etapa de build |
| `supabase/` | Scripts SQL do banco (tabelas, RLS, cargas, funções de cálculo) e `LEIA-ME.md` com a instalação |
| `testes/` | Teste automatizado do site (navegador + Postgres local) usado para validar as telas antes da publicação |

## Como reproduzir

```bash
python scripts/tratamento_dados.py "G7 - Base de dados - CicloPET Bahia.xlsx" saida/   # gera dados/tratados + log
python scripts/cpm.py                                                                   # linha de base: término du 278 (14/01/2027)
```

## Números de controle (seção 5 do dossiê): todos conferidos ✅

| Conferência | Esperado | Obtido |
|---|---|---|
| Linhas da tabela 15, sem duplicatas | 1.509 | 1.509 |
| Hh até 06/11/2026 | 107.650,2 | 107.650,2 |
| Custo direto até 06/11/2026 | R$ 25.027.069,69 | R$ 25.027.069,69 |
| Pedidos de compra | 177 | 177 |
| Hh até 13/11/2026 (após a semana de campo) | 110.527,8 | 110.527,8 |
| Custo direto até 13/11/2026 | R$ 27.896.701,08 | R$ 27.896.701,08 |

## Convenções

Seguimos o **Anexo D** do enunciado. As premissas de cada documento estão na aba **Rosto** das planilhas.
Todo número do relatório indica a tabela e o filtro de onde saiu.

## Sistema (Parte 2)

| Camada | Tecnologia | Onde |
|---|---|---|
| Banco na nuvem (R2) | Supabase / Postgres, com RLS: todos leem, só logado grava | `supabase/` |
| Cálculos (R4 a R10, R12) | Funções SQL com a data de corte como parâmetro | `supabase/05_funcoes.sql` |
| Site | HTML + JS (módulos ES), Chart.js e Three.js via CDN | `app/` |
| Publicação | GitHub Pages, ligado à `main` | Settings → Pages |

**Requisitos atendidos:**
- **R1** Importação e conferência (aba Conferência)
- **R2** Banco compartilhado
- **R3** 12 telas de lançamento
- **R4** Avanço físico
- **R5** Valor agregado e curva S
- **R6** PPC e Pareto
- **R7** RUP por atividade e por encarregado
- **R8** Histograma e absenteísmo
- **R9** Suprimentos e data-limite
- **R10** Disponibilidade, utilização, MTBF e MTTR
- **R11** Dashboard com filtro de data
- **R12** Modelo 3D com controle de data e clique na zona
- **Prazo** Caminho crítico atualizado e previsão de término (Parte 3)
- **Conferência com o caderno** M1, M3 e M4

**Publicar:** no GitHub, *Settings → Pages → Source: Deploy from a branch → main / (root) → Save*. Em 1 a 2 minutos o link acima fica no ar.
