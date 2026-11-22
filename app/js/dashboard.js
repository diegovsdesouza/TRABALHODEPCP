// R11 · Dashboard gerencial de uma tela, com filtro pela data de corte (cabeçalho).
import { Chart, registerables } from 'chart.js';
import { rpc, fmt, htmlTabela, dataCorte } from './db.js';
Chart.register(...registerables);

const graficos = [];
export function limparGraficos() { while (graficos.length) graficos.pop().destroy(); }
export function grafico(canvas, cfg) {
  cfg.options = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom' } }, ...(cfg.options || {}) };
  const g = new Chart(canvas, cfg); graficos.push(g); return g;
}
const kpi = (titulo, valor, fonte, estado = '') => `<div class="kpi ${estado}"><small>${titulo}</small><b>${valor}</b><div class="fonte">${fonte}</div></div>`;

export async function paginaDashboard(alvo) {
  limparGraficos();
  const d = dataCorte();
  const [k, fases, curva, ppc, pareto, hist, pz] = await Promise.all([
    rpc('fn_kpis', { p_data: d }), rpc('fn_evm_fase', { p_data: d }), rpc('fn_curva_s', {}), rpc('fn_ppc_semana'),
    rpc('fn_pareto_causas', {}), rpc('fn_histograma', { p_ini: '2025-12-01', p_fim: d }), rpc('fn_prazo', { p_data: d })]);
  const ppcAte = ppc.filter((p) => p.data_inicio <= d);
  alvo.innerHTML = `<h2>Dashboard · situação em ${fmt.data(d)} (du ${k.du})</h2>
    <div class="kpis">
      ${kpi('Término previsto', fmt.data(pz.termino_previsto), `LB ${fmt.data(pz.termino_lb)} · contrato ${fmt.data(pz.contrato)}`, pz.atraso_vs_contrato_du > 0 ? 'ruim' : 'bom')}
      ${kpi('Atraso sobre o contrato', pz.atraso_vs_contrato_du + ' du', 'multa ' + fmt.rs(pz.multa_rs), pz.atraso_vs_contrato_du > 0 ? 'ruim' : 'bom')}
      ${kpi('Valor planejado (VP)', fmt.mi(k.vp), 'fn_evm_fase')}
      ${kpi('Valor agregado (VA)', fmt.mi(k.va), 'rdo_producao × orcamento')}
      ${kpi('Custo real (CR)', fmt.mi(k.cr), 'custos_apropriados ≠ INDIRETO')}
      ${kpi('IDP', fmt.i(k.idp), 'VA ÷ VP', k.idp < 0.95 ? 'ruim' : 'bom')}
      ${kpi('IDC', fmt.i(k.idc), 'VA ÷ CR', k.idc < 0.95 ? 'ruim' : 'bom')}
      ${kpi('Estimativa no término', fmt.mi(k.eat), `ONT ${fmt.mi(k.ont)} ÷ IDC`, k.eat > k.ont ? 'ruim' : '')}
      ${kpi('Avanço físico', fmt.pct(k.avanco_fisico), 'VA ÷ ONT')}
      ${kpi('PPC última semana', fmt.pct(k.ppc_ultima, 0), 'plano_semanal (meta 80%)', k.ppc_ultima < 0.8 ? 'ruim' : 'bom')}
      ${kpi('PPC 4 semanas', fmt.pct(k.ppc_4sem, 0), 'plano_semanal', k.ppc_4sem < 0.8 ? 'ruim' : 'bom')}
      ${kpi('Absenteísmo (7 dias)', fmt.pct(k.absenteismo_semana), 'rdo_mao_de_obra')}
      ${kpi('Pico de efetivo real', fmt.n(k.efetivo_pico_real) + ' pessoas', 'limite NR-18: 160', k.efetivo_pico_real > 160 ? 'ruim' : '')}
      ${kpi('Restrições bloqueando', fmt.n(k.restricoes_bloqueando), 'restricoes vencidas e abertas', k.restricoes_bloqueando > 0 ? 'ruim' : 'bom')}
      ${kpi('Reprovação FVS', fmt.pct(k.fvs_reprovacao), `${fmt.n(k.hh_retrabalho, 0)} Hh de retrabalho`)}
      ${kpi('Acidentes', fmt.n(k.acidentes), 'ocorrencias_seguranca', k.acidentes > 0 ? 'ruim' : '')}
    </div>
    <div class="grade">
      <div class="cartao"><h3>Curva S (R$ acumulado)</h3><div style="height:280px"><canvas id="gCurva"></canvas></div><p class="fonte">fn_curva_s · VP da linha de base (D2); VA e CR realizados</p></div>
      <div class="cartao"><h3>PPC semanal</h3><div style="height:280px"><canvas id="gPpc"></canvas></div><p class="fonte">fn_ppc_semana · concluído = realizado ≥ 97% da meta</p></div>
      <div class="cartao"><h3>Pareto das causas de não cumprimento</h3><div style="height:280px"><canvas id="gPareto"></canvas></div><p class="fonte">fn_pareto_causas · causas padronizadas</p></div>
      <div class="cartao"><h3>Efetivo diário: linha de base × real</h3><div style="height:280px"><canvas id="gHist"></canvas></div><p class="fonte">fn_histograma · limite do canteiro 160 pessoas</p></div>
    </div>
    <div class="cartao" style="margin-top:12px"><h3>Valor agregado por fase</h3>${tabelaFases(fases)}<p class="fonte">fn_evm_fase · EAT = orçamento ÷ IDC (Anexo D)</p></div>`;

  grafico(alvo.querySelector('#gCurva'), { type: 'line', data: { labels: curva.map((c) => c.data_fim.slice(5) + '/' + c.data_fim.slice(2, 4)), datasets: [
    { label: 'VP', data: curva.map((c) => c.vp_acum), borderColor: '#2f75b5', pointRadius: 0 },
    { label: 'VA', data: curva.map((c) => (c.data_fim <= d ? c.va_acum : null)), borderColor: '#2e7d32', pointRadius: 0 },
    { label: 'CR', data: curva.map((c) => (c.data_fim <= d ? c.cr_acum : null)), borderColor: '#c00000', pointRadius: 0 }] },
    options: { scales: { y: { ticks: { callback: (v) => (v / 1e6).toFixed(0) + ' mi' } } } } });
  grafico(alvo.querySelector('#gPpc'), { type: 'bar', data: { labels: ppcAte.map((p) => p.semana.slice(5)), datasets: [
    { label: 'PPC', data: ppcAte.map((p) => p.ppc * 100), backgroundColor: ppcAte.map((p) => (p.ppc < 0.8 ? '#e57373' : '#81c784')) },
    { label: 'Meta 80%', type: 'line', data: ppcAte.map(() => 80), borderColor: '#555', pointRadius: 0, borderDash: [4, 4] }] },
    options: { scales: { y: { max: 100, ticks: { callback: (v) => v + '%' } } } } });
  grafico(alvo.querySelector('#gPareto'), { type: 'bar', data: { labels: pareto.map((p) => p.causa), datasets: [
    { label: 'Ocorrências', data: pareto.map((p) => p.ocorrencias), backgroundColor: '#2f75b5', yAxisID: 'y' },
    { label: '% acumulado', type: 'line', data: pareto.map((p) => p.pct_acum * 100), borderColor: '#c00000', yAxisID: 'y2' }] },
    options: { scales: { y2: { position: 'right', max: 100, ticks: { callback: (v) => v + '%' } } } } });
  grafico(alvo.querySelector('#gHist'), { type: 'line', data: { labels: hist.map((h) => h.data.slice(5)), datasets: [
    { label: 'Linha de base', data: hist.map((h) => h.efetivo_linha_base), borderColor: '#2f75b5', pointRadius: 0, stepped: true },
    { label: 'Presente (real)', data: hist.map((h) => h.efetivo_presente), borderColor: '#c00000', pointRadius: 0 },
    { label: 'Limite 160', data: hist.map(() => 160), borderColor: '#555', borderDash: [4, 4], pointRadius: 0 }] } });
}

export function tabelaFases(fases) {
  return htmlTabela(fases, [
    { campo: 'fase', titulo: 'Fase', t: 1 }, { campo: 'orcamento', titulo: 'Orçamento', f: fmt.rs }, { campo: 'vp', titulo: 'VP', f: fmt.rs },
    { campo: 'va', titulo: 'VA', f: fmt.rs }, { campo: 'cr', titulo: 'CR', f: fmt.rs },
    { campo: 'var_prazo', titulo: 'VPr = VA − VP', f: fmt.rs, cor: (v) => (v < 0 ? 'neg' : '') },
    { campo: 'var_custo', titulo: 'VC = VA − CR', f: fmt.rs, cor: (v) => (v < 0 ? 'neg' : '') },
    { campo: 'idp', titulo: 'IDP', f: fmt.i, cor: (v) => (v != null && v < 0.95 ? 'neg' : '') },
    { campo: 'idc', titulo: 'IDC', f: fmt.i, cor: (v) => (v != null && v < 0.95 ? 'neg' : '') },
    { campo: 'eat', titulo: 'EAT', f: fmt.rs }, { campo: 'avanco_fisico', titulo: 'Avanço', f: (v) => fmt.pct(v) }],
  { classeLinha: (l) => (l.fase === 'TOTAL' ? 'total' : '') });
}
