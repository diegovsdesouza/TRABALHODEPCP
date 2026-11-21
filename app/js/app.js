// Roteador, login e página de conferência.
import { sb, rpc, fmt, toast, htmlTabela, dataCorte } from './db.js';
import { CONTROLE } from './config.js';
import { paginaDashboard } from './dashboard.js';
import { paginaLancamentos } from './telas.js';
import { paginaIndicadores } from './indicadores.js';
import { paginaModelo3D } from './modelo3d.js';
import { paginaPrazo } from './prazo.js';

const el = document.getElementById('conteudo');
export let usuario = null;

const rotas = {
  '#/dashboard': paginaDashboard,
  '#/lancamentos': paginaLancamentos,
  '#/prazo': paginaPrazo,
  '#/indicadores': paginaIndicadores,
  '#/3d': paginaModelo3D,
  '#/conferencia': paginaConferencia,
};

async function navegar() {
  const h = rotas[location.hash] ? location.hash : '#/dashboard';
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('ativo', a.getAttribute('href') === h));
  el.innerHTML = '<p class="carregando">Carregando…</p>';
  try { await rotas[h](el, { usuario }); }
  catch (e) { console.error(e); el.innerHTML = `<div class="alerta">Erro: ${e.message}</div>`; }
}

// ---------- login (Supabase Auth, e-mail e senha)
const dlg = document.getElementById('dlgLogin');
const btn = document.getElementById('btnLogin');
function mostrarUsuario() {
  document.getElementById('quem').textContent = usuario ? usuario.email : 'visitante (só leitura)';
  btn.textContent = usuario ? 'Sair' : 'Entrar';
}
btn.onclick = async () => {
  if (usuario) { await sb.auth.signOut(); return; }
  document.getElementById('msgLogin').textContent = ''; dlg.showModal();
};
document.getElementById('formLogin').addEventListener('submit', async (ev) => {
  const acao = ev.submitter?.value;
  if (acao === 'cancelar') return;
  ev.preventDefault();
  const f = new FormData(ev.target); const msg = document.getElementById('msgLogin');
  const cred = { email: f.get('email'), password: f.get('senha') };
  const { error } = acao === 'criar' ? await sb.auth.signUp(cred) : await sb.auth.signInWithPassword(cred);
  if (error) { msg.textContent = error.message; return; }
  if (acao === 'criar') { msg.textContent = 'Conta criada. Se o Supabase pedir confirmação, abra o e-mail e depois clique em Entrar.'; return; }
  dlg.close();
});
sb.auth.onAuthStateChange((_e, sess) => { usuario = sess?.user ?? null; mostrarUsuario(); if (location.hash === '#/lancamentos') navegar(); });

document.getElementById('dataCorte').addEventListener('change', navegar);
window.addEventListener('hashchange', navegar);
const { data } = await sb.auth.getSession(); usuario = data.session?.user ?? null; mostrarUsuario();
navegar();

// ---------- R1 · conferência com os números de controle do dossiê
async function paginaConferencia(alvo) {
  const linhas = [];
  for (const c of CONTROLE) {
    const r = await rpc('fn_controle', { p_data: c.corte });
    const v = r.find((x) => x.indicador === c.indicador)?.valor;
    linhas.push({ ...c, obtido: v, ok: v != null && Math.abs(v - c.esperado) < 0.01 });
  }
  const atual = await rpc('fn_controle', { p_data: dataCorte() });
  const [sub, oee, evm] = await Promise.all([rpc('fn_cpm_subrede', {}), rpc('fn_oee', { p_ini: '2026-09-28', p_fim: '2026-09-28', p_posto: 'PT03', p_turno: 2 }),
    rpc('fn_evm_fase', { p_data: '2026-10-16' })]);
  const tot = evm.find((f) => f.fase === 'TOTAL');
  const cad = [
    { folha: 'M1 · duração da sub-rede', esperado: '71 du', sistema: Math.max(...sub.map((x) => x.tc_du)) + ' du', fonte: 'fn_cpm_subrede' },
    { folha: 'M1 · caminho crítico', esperado: 'A25 → A26 → A30 → A35 → A36', sistema: sub.filter((x) => x.critica).map((x) => x.id_atividade).join(' → '), fonte: 'fn_cpm_subrede' },
    { folha: 'M3 · OEE do PT03, 28/09, turno 2', esperado: '37,6%', sistema: fmt.pct(oee[0]?.oee), fonte: 'fn_oee (tabela 27)' },
    { folha: 'M4 · VA total em 16/10 (R$ mil)', esperado: '≈ 17.290 (dossiê, % arredondados)', sistema: fmt.n(tot.va / 1000, 1), fonte: 'fn_evm_fase' },
    { folha: 'M4 · IDP / IDC em 16/10', esperado: '0,523 / 0,922', sistema: fmt.n(tot.idp, 3) + ' / ' + fmt.n(tot.idc, 3), fonte: 'fn_evm_fase' }];
  alvo.innerHTML = `<h2>Conferência dos números de controle (dossiê, seção 5)</h2>
    <div class="cartao">${htmlTabela(linhas, [
      { campo: 'indicador', titulo: 'Conferência', t: 1 }, { campo: 'corte', titulo: 'Corte', f: fmt.data },
      { campo: 'esperado', titulo: 'Esperado', f: (v) => fmt.n(v, 2) }, { campo: 'obtido', titulo: 'Sistema', f: (v) => fmt.n(v, 2) },
      { campo: 'ok', titulo: 'Situação', f: (v) => v ? '<span class="ok">✔ confere</span>' : '<span class="erro">✘ diverge</span>' }])}
      <p class="fonte">Fonte: função fn_controle (supabase/05_funcoes.sql). Os dois últimos só conferem depois que a semana de campo (09 a 13/11) for lançada pelas telas.</p></div>
    <h3 style="margin-top:16px">Conferência obrigatória com o caderno manuscrito (seção 5 do enunciado)</h3>
    <div class="cartao">${htmlTabela(cad, [{ campo: 'folha', titulo: 'Folha', t: 1 }, { campo: 'esperado', titulo: 'Caderno', t: 1 }, { campo: 'sistema', titulo: 'Sistema', t: 1 }, { campo: 'fonte', titulo: 'Fonte', t: 1 }])}</div>
    <h3 style="margin-top:16px">Na data de corte selecionada (${fmt.data(dataCorte())})</h3>
    <div class="cartao">${htmlTabela(atual, [{ campo: 'indicador', titulo: 'Indicador', t: 1 }, { campo: 'valor', titulo: 'Valor', f: (v) => fmt.n(v, 2) }, { campo: 'fonte', titulo: 'Tabela e filtro', t: 1 }])}</div>`;
}
export { toast };
