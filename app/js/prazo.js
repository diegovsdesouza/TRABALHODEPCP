// Prazo: linha de base (D2), caminho crítico atualizado na data de corte e sub-rede da folha M1.
import { rpc, fmt, htmlTabela, dataCorte } from './db.js';

const M1 = ['A23', 'A24', 'A25', 'A26', 'A27', 'A28', 'A29', 'A30', 'A31', 'A35', 'A36'];
const du = (v) => (v == null ? '—' : v);

export async function paginaPrazo(alvo) {
  const d = dataCorte();
  const [p, atual, lb] = await Promise.all([rpc('fn_prazo', { p_data: d }), rpc('fn_cpm_atualizado', { p_data: d }), rpc('fn_cpm_linha_base')]);
  const abertas = atual.filter((a) => a.situacao !== 'CONCLUÍDA');
  alvo.innerHTML = `<h2>Prazo · caminho crítico em ${fmt.data(d)} (du ${p.du_status})</h2>
    <div class="kpis">
      <div class="kpi"><small>Término da linha de base</small><b>${fmt.data(p.termino_lb)}</b><div class="fonte">du ${p.termino_lb_du} (D2)</div></div>
      <div class="kpi ${p.atraso_vs_lb_du > 0 ? 'ruim' : 'bom'}"><small>Término previsto</small><b>${fmt.data(p.termino_previsto)}</b><div class="fonte">du ${p.termino_previsto_du} · ${p.atraso_vs_lb_du} du após a LB</div></div>
      <div class="kpi"><small>Data contratual</small><b>${fmt.data(p.contrato)}</b><div class="fonte">du ${p.contrato_du}</div></div>
      <div class="kpi ${p.atraso_vs_contrato_du > 0 ? 'ruim' : 'bom'}"><small>Atraso sobre o contrato</small><b>${p.atraso_vs_contrato_du} du</b><div class="fonte">multa de R$ 22.100/du</div></div>
      <div class="kpi ${p.multa_rs > 0 ? 'ruim' : ''}"><small>Multa estimada</small><b>${fmt.rs(p.multa_rs)}</b><div class="fonte">atraso × multa (tabela 01)</div></div>
      <div class="kpi ${p.ganho_perdido_rs > 0 ? 'ruim' : ''}"><small>Ganho operacional perdido</small><b>${fmt.rs(p.ganho_perdido_rs)}</b><div class="fonte">atraso vs LB × R$ 37.300/du</div></div>
    </div>
    <div class="alerta"><b>Caminho crítico atualizado:</b> ${(p.caminho_critico || []).join(' → ')}</div>
    <div class="cartao"><h3>Atividades em aberto: previsão a partir da data de corte</h3>${htmlTabela(abertas, [
      { campo: 'id_atividade', titulo: 'ID', t: 1 }, { campo: 'nome_atividade', titulo: 'Atividade', t: 1 }, { campo: 'situacao', titulo: 'Situação', t: 1 },
      { campo: 'avanco', titulo: 'Avanço', f: (v) => fmt.pct(v) }, { campo: 'duracao_restante_du', titulo: 'Saldo (du)' }, { campo: 'ic_du', titulo: 'IC (du)', f: du },
      { campo: 'tc_du', titulo: 'TC (du)', f: du }, { campo: 'folga_total_du', titulo: 'Folga (du)', f: du }, { campo: 'critica', titulo: 'Crítica', f: (v) => (v ? '<span class="erro">SIM</span>' : '') },
      { campo: 'termino_previsto', titulo: 'Término previsto', f: fmt.data }, { campo: 'desvio_du', titulo: 'Desvio vs LB (du)', f: du, cor: (v) => (v > 0 ? 'neg' : '') }])}
      <p class="fonte">fn_cpm_atualizado · premissas: concluída = fixada; em andamento = saldo ⌈duração × (1 − avanço)⌉ a partir do du seguinte ao corte; não iniciada começa no mínimo no du seguinte; produtividade orçada daqui em diante; mesmas ligações TI/II da tabela 04.</p></div>
    <div class="cartao" style="margin-top:12px"><h3>Sub-rede da folha M1 (conferência obrigatória com o caderno)</h3>
      <p class="nota">Atividades: <input id="m1" value="${M1.join(',')}" style="width:420px"> <button class="sec" id="calcM1">Calcular</button></p><div id="resM1"></div></div>
    <div class="cartao" style="margin-top:12px"><h3>Linha de base (D2) recalculada no banco</h3>${htmlTabela(lb, [
      { campo: 'id_atividade', titulo: 'ID', t: 1 }, { campo: 'nome_atividade', titulo: 'Atividade', t: 1 }, { campo: 'duracao_du', titulo: 'Dur. (du)' },
      { campo: 'ic_du', titulo: 'IC' }, { campo: 'tc_du', titulo: 'TC' }, { campo: 'it_du', titulo: 'IT' }, { campo: 'tt_du', titulo: 'TT' }, { campo: 'folga_total_du', titulo: 'Folga' },
      { campo: 'critica', titulo: 'Crítica', f: (v) => (v ? '<span class="erro">SIM</span>' : '') }, { campo: 'inicio', titulo: 'Início', f: fmt.data }, { campo: 'termino', titulo: 'Término', f: fmt.data }])}
      <p class="fonte">fn_cpm_linha_base · duração = ⌈Q × RUP ÷ (efetivo × 8 h)⌉ (Anexo D); deve bater com a planilha D2.</p></div>`;
  const calc = async () => {
    const ids = alvo.querySelector('#m1').value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const r = await rpc('fn_cpm_subrede', { p_ids: ids });
    const fim = Math.max(...r.map((x) => x.tc_du)); const cp = r.filter((x) => x.critica).map((x) => x.id_atividade).join(' → ');
    alvo.querySelector('#resM1').innerHTML = `<p><b>Duração da sub-rede: ${fim} du</b> · caminho crítico: <b>${cp}</b></p>` + htmlTabela(r, [
      { campo: 'id_atividade', titulo: 'ID', t: 1 }, { campo: 'duracao_du', titulo: 'Dur.' }, { campo: 'ic_du', titulo: 'IC' }, { campo: 'tc_du', titulo: 'TC' },
      { campo: 'it_du', titulo: 'IT' }, { campo: 'tt_du', titulo: 'TT' }, { campo: 'folga_total_du', titulo: 'Folga' }, { campo: 'critica', titulo: 'Crítica', f: (v) => (v ? 'SIM' : '') }]) +
      '<p class="fonte">fn_cpm_subrede · só as ligações entre as atividades listadas; a sub-rede começa no du 1.</p>';
  };
  alvo.querySelector('#calcM1').onclick = calc; calc();
}
