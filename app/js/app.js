// Roteador, login e página de conferência.
import { sb, rpc, fmt, toast, htmlTabela, dataCorte } from './db.js';
import { CONTROLE } from './config.js';
import { paginaDashboard } from './dashboard.js';
import { paginaLancamentos } from './telas.js';
import { paginaIndicadores } from './indicadores.js';
import { paginaModelo3D } from './modelo3d.js';

const el = document.getElementById('conteudo');
export let usuario = null;

const rotas = {
  '#/dashboard': paginaDashboard,
  '#/lancamentos': paginaLancamentos,
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
  alvo.innerHTML = `<h2>Conferência dos números de controle (dossiê, seção 5)</h2>
    <div class="cartao">${htmlTabela(linhas, [
      { campo: 'indicador', titulo: 'Conferência', t: 1 }, { campo: 'corte', titulo: 'Corte', f: fmt.data },
      { campo: 'esperado', titulo: 'Esperado', f: (v) => fmt.n(v, 2) }, { campo: 'obtido', titulo: 'Sistema', f: (v) => fmt.n(v, 2) },
      { campo: 'ok', titulo: 'Situação', f: (v) => v ? '<span class="ok">✔ confere</span>' : '<span class="erro">✘ diverge</span>' }])}
      <p class="fonte">Fonte: função fn_controle (supabase/05_funcoes.sql). Os dois últimos só conferem depois que a semana de campo (09 a 13/11) for lançada pelas telas.</p></div>
    <h3 style="margin-top:16px">Na data de corte selecionada (${fmt.data(dataCorte())})</h3>
    <div class="cartao">${htmlTabela(atual, [{ campo: 'indicador', titulo: 'Indicador', t: 1 }, { campo: 'valor', titulo: 'Valor', f: (v) => fmt.n(v, 2) }, { campo: 'fonte', titulo: 'Tabela e filtro', t: 1 }])}</div>`;
}
export { toast };
