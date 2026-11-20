// Configuração do Supabase do G7.
// A chave PUBLICÁVEL (publishable/anon) pode ficar no código: quem protege os dados são as regras RLS do banco
// (supabase/01_schema.sql: todos leem, só usuário logado grava). NUNCA coloque aqui a chave secreta (service_role).
export const SUPABASE_URL = 'https://jjpggdzqqcwczccxnobj.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_2Kuh_1Xy6gUUtvWRnuTSyQ_QdwZiFeW';

export const DATA_STATUS = '2026-11-13';

// Números de controle da seção 5 do dossiê (requisito R1)
export const CONTROLE = [
  { indicador: 'Linhas da tabela 15 (mão de obra)', corte: '2026-11-06', esperado: 1509 },
  { indicador: 'Homens-hora apontados (normais + extras)', corte: '2026-11-06', esperado: 107650.2 },
  { indicador: 'Custo direto apropriado (R$)', corte: '2026-11-06', esperado: 25027069.69 },
  { indicador: 'Pedidos de compra emitidos', corte: '2026-11-06', esperado: 177 },
  { indicador: 'Homens-hora apontados (normais + extras)', corte: '2026-11-13', esperado: 110527.8 },
  { indicador: 'Custo direto apropriado (R$)', corte: '2026-11-13', esperado: 27896701.08 },
];
