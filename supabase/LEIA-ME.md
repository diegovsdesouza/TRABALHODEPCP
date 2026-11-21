# Instalação do banco no Supabase (15 minutos)

Projeto: `https://jjpggdzqqcwczccxnobj.supabase.co`

## 1. Criar as tabelas e carregar o histórico

No painel do Supabase: **SQL Editor → New query**. Para **cada arquivo abaixo, nesta ordem**, abra o arquivo, copie todo o conteúdo, cole e clique em **Run**. Espere o "Success" antes de passar para o próximo.

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `01_schema.sql` | Cria as 31 tabelas e as regras de acesso (RLS) |
| 2 | `02_carga_bloco_A_planejamento.sql` | Tabelas 01 a 14 + linha de base do D2 |
| 3 | `03_carga_bloco_B_execucao.sql` | Tabelas 15 a 24, histórico tratado até 06/11 (o maior arquivo, ~450 KB) |
| 4 | `04_carga_bloco_C_operacao.sql` | Tabelas 25 a 30 |
| 5 | `05_funcoes.sql` | Funções de cálculo: avanço, valor agregado, PPC, RUP, histograma, suprimentos, equipamentos, 3D |
| 6 | `06_prazo_oee.sql` | Caminho crítico (linha de base, atualizado e sub-rede M1), previsão de término, multa e OEE |

**Conferência imediata:** rode `select * from fn_controle('2026-11-06');` e verifique se aparecem 1509 · 107650,2 · 25.027.069,69 · 177.

> Se o editor reclamar do tamanho do arquivo 3, divida-o em duas partes (cada `insert` é independente) ou use **Table Editor → Import data from CSV** com os arquivos de `dados/tratados/`.

## 2. Login dos integrantes

**Authentication → Sign In / Providers → Email**: deixe habilitado e **desligue "Confirm email"**. Assim cada integrante cria a conta pelo próprio site, sem precisar confirmar por e-mail.

Cada integrante cria a **sua** conta (botão *Entrar → Criar conta*). O sistema grava `lancado_por_email` em todo lançamento, o que prova a exigência de "pelo menos três integrantes diferentes".

## 3. Segurança

- A chave **publicável** está em `app/js/config.js`. É pública por definição: quem protege os dados é a RLS do `01_schema.sql`, em que todos leem e só usuário logado grava.
- A chave **secreta** (service_role) **nunca** vai para o repositório nem para o código.

## 4. Regerar os scripts (se os dados mudarem)

```bash
python scripts/build_supabase.py      # recria 01 a 04 a partir de dados/tratados
```
