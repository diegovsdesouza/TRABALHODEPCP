// R4, R5, R7, R8, R9 e R10 · indicadores detalhados, todos com a data de corte do cabeçalho.
import { rpc, fmt, htmlTabela, dataCorte } from './db.js';
import { grafico, limparGraficos, tabelaFases } from './dashboard.js';

const ABAS = {
  avanco: ['Avanço físico (R4)', abaAvanco],
  evm: ['Valor agregado (R5)', abaEvm],
  rup: ['Produtividade · RUP (R7)', abaRup],
  hist: ['Efetivo e absenteísmo (R8)', abaHist],
  supr: ['Suprimentos (R9)', abaSupr],
  equip: ['Equipamentos (R10)', abaEquip],
  oee: ['Operação · OEE do site atual', abaOee],
};

export async function paginaIndicadores(alvo) {
  alvo.innerHTML = `<h2>Indicadores · corte em ${fmt.data(dataCorte())}</h2>
    <div class="abas">${Object.entries(ABAS).map(([k, [t]]) => `<button data-a="${k}">${t}</button>`).join('')}</div><div id="aba"></div>`;
  const abrir = async (k) => {
    sessionStorage.setItem('abaInd', k); limparGraficos();
    alvo.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativo', b.dataset.a === k));
    const box = alvo.querySelector('#aba'); box.innerHTML = '<p class="carregando">Calculando…</p>';
    await ABAS[k][1](box, dataCorte());
  };
  alvo.querySelectorAll('.abas button').forEach((b) => (b.onclick = () => abrir(b.dataset.a)));
  abrir(sessionStorage.getItem('abaInd') || 'avanco');
}

async function abaAvanco(box, d) {
  const av = await rpc('fn_avanco_atividade', { p_data: d });
  const porFase = {};
  av.forEach((a) => { const f = (porFase[a.fase] ||= { fase: a.fase, custo: 0, va: 0, plan: 0 }); f.custo += +a.custo_orcado; f.va += +a.va; f.plan += a.pct_planejado * a.custo_orcado; });
  const fases = Object.values(porFase).map((f) => ({ ...f, real: f.va / f.custo, planejado: f.plan / f.custo }));
  box.innerHTML = `<div class="cartao"><h3>Avanço físico por fase (ponderado pelo custo orçado)</h3>${htmlTabela(fases, [
      { campo: 'fase', titulo: 'Fase', t: 1 }, { campo: 'planejado', titulo: 'Planejado', f: (v) => fmt.pct(v) }, { campo: 'real', titulo: 'Real', f: (v) => fmt.pct(v) },
      { campo: 'real', titulo: 'Desvio (p.p.)', f: (v, l) => fmt.n((v - l.planejado) * 100, 1), cor: (v, l) => (v - l.planejado < -0.05 ? 'neg' : '') }])}</div>
    <div class="cartao" style="margin-top:12px"><h3>Avanço físico por atividade</h3>${htmlTabela(av, [
      { campo: 'id_atividade', titulo: 'ID', t: 1 }, { campo: 'nome_atividade', titulo: 'Atividade', t: 1 }, { campo: 'critica', titulo: 'Crítica', f: (v) => (v ? 'SIM' : '') },
      { campo: 'quantidade_orcada', titulo: 'Qtd orçada', f: (v) => fmt.n(v, 2) }, { campo: 'quantidade_executada', titulo: 'Executado', f: (v) => fmt.n(v, 2) },
      { campo: 'unidade', titulo: 'Un.', t: 1 }, { campo: 'pct_planejado', titulo: '% planejado', f: (v) => fmt.pct(v) }, { campo: 'avanco', titulo: '% real', f: (v) => fmt.pct(v) },
      { campo: 'desvio_pp', titulo: 'Desvio (p.p.)', f: (v) => fmt.n(v, 1), cor: (v) => (v <= -10 ? 'neg' : '') }])}
      <p class="fonte">fn_avanco_atividade · Σ rdo_producao ÷ quantidade orçada, limitado a 100% · % planejado linear na linha de base (D2)</p></div>`;
}

async function abaEvm(box, d) {
  const [f, nat] = await Promise.all([rpc('fn_evm_fase', { p_data: d }), rpc('fn_cr_natureza', { p_data: d })]);
  box.innerHTML = `<div class="cartao"><h3>Valor agregado por fase</h3>${tabelaFases(f)}<p class="fonte">fn_evm_fase · VP linear na linha de base; VA = avanço × custo orçado; CR = custos_apropriados ≠ INDIRETO</p></div>
    <div class="cartao" style="margin-top:12px"><h3>Custo real por natureza</h3>${htmlTabela(nat.map((n) => ({ ...n, pct: n.orcado ? n.cr / n.orcado : null })), [
      { campo: 'categoria', titulo: 'Natureza', t: 1 }, { campo: 'orcado', titulo: 'Orçado total', f: fmt.rs }, { campo: 'cr', titulo: 'CR até a data', f: fmt.rs },
      { campo: 'pct', titulo: 'CR ÷ orçado', f: (v) => fmt.pct(v) }])}<p class="fonte">fn_cr_natureza · INDIRETO = administração local (R$ 176 mil/mês orçados), fora do CR direto</p></div>`;
}

async function abaRup(box, d) {
  const [r, e] = await Promise.all([rpc('fn_rup', { p_data: d }), rpc('fn_rup_encarregado', { p_data: d })]);
  const cols = [{ campo: 'id_atividade', titulo: 'ID', t: 1 }, { campo: 'nome_atividade', titulo: 'Atividade', t: 1 }, { campo: 'encarregado', titulo: 'Encarregado', t: 1 },
    { campo: 'rup_orcada', titulo: 'RUP orçada (Hh/un)', f: (v) => fmt.n(v, 3) }, { campo: 'rup_real', titulo: 'RUP real (Hh/un)', f: (v) => fmt.n(v, 3) },
    { campo: 'desvio_pct', titulo: 'Desvio', f: (v) => fmt.n(v, 1) + '%', cor: (v) => (v > 10 ? 'neg' : v < 0 ? 'pos' : '') }];
  const melhores = [...r].sort((a, b) => a.desvio_pct - b.desvio_pct).slice(0, 5);
  box.innerHTML = `<div class="grade"><div class="cartao"><h3>5 piores (RUP real acima da orçada)</h3>${htmlTabela(r.slice(0, 5), cols)}</div>
    <div class="cartao"><h3>5 melhores</h3>${htmlTabela(melhores, cols)}</div></div>
    <div class="cartao" style="margin-top:12px"><h3>Por encarregado</h3>${htmlTabela(e, [{ campo: 'encarregado', titulo: 'Encarregado', t: 1 }, { campo: 'atividades', titulo: 'Atividades' },
      { campo: 'hh_real', titulo: 'Hh reais', f: (v) => fmt.n(v, 0) }, { campo: 'hh_orcadas_para_o_executado', titulo: 'Hh orçadas p/ o executado', f: (v) => fmt.n(v, 0) },
      { campo: 'desvio_pct', titulo: 'Desvio', f: (v) => fmt.n(v, 1) + '%', cor: (v) => (v > 10 ? 'neg' : '') }])}
    <p class="fonte">fn_rup / fn_rup_encarregado · RUP real = Hh (normais + extras) ÷ quantidade executada (Anexo D)</p></div>
    <div class="cartao" style="margin-top:12px"><h3>Todas as atividades por esforço</h3>${htmlTabela(r, cols)}</div>`;
}

async function abaHist(box, d) {
  const h = await rpc('fn_histograma', { p_ini: '2025-12-01', p_fim: d });
  const sem = {}; h.forEach((x) => { const k = x.data.slice(0, 7); const s = (sem[k] ||= { mes: k, esc: 0, pres: 0, pico: 0 }); s.esc += x.efetivo_escalado; s.pres += x.efetivo_presente; s.pico = Math.max(s.pico, x.efetivo_presente); });
  const meses = Object.values(sem).map((s) => ({ ...s, abs: s.esc ? 1 - s.pres / s.esc : null }));
  box.innerHTML = `<div class="cartao"><h3>Efetivo diário: linha de base × escalado × presente</h3><div style="height:300px"><canvas id="g1"></canvas></div><p class="fonte">fn_histograma · linha de base = equipes da tabela 07 nas datas mais cedo (D2/D4)</p></div>
    <div class="cartao" style="margin-top:12px"><h3>Absenteísmo por mês</h3>${htmlTabela(meses, [{ campo: 'mes', titulo: 'Mês', t: 1 }, { campo: 'esc', titulo: 'Homens-dia escalados', f: (v) => fmt.n(v) },
      { campo: 'pres', titulo: 'Homens-dia presentes', f: (v) => fmt.n(v) }, { campo: 'abs', titulo: 'Absenteísmo', f: (v) => fmt.pct(v) }, { campo: 'pico', titulo: 'Pico diário', f: (v) => fmt.n(v), cor: (v) => (v > 160 ? 'neg' : '') }])}
      <p class="fonte">Absenteísmo = 1 − presentes ÷ previstos (rdo_mao_de_obra)</p></div>`;
  grafico(box.querySelector('#g1'), { type: 'line', data: { labels: h.map((x) => x.data.slice(5)), datasets: [
    { label: 'Linha de base', data: h.map((x) => x.efetivo_linha_base), borderColor: '#2f75b5', pointRadius: 0, stepped: true },
    { label: 'Escalado', data: h.map((x) => x.efetivo_escalado), borderColor: '#f9a825', pointRadius: 0 },
    { label: 'Presente', data: h.map((x) => x.efetivo_presente), borderColor: '#c00000', pointRadius: 0 },
    { label: 'Limite 160', data: h.map(() => 160), borderColor: '#555', borderDash: [4, 4], pointRadius: 0 }] } });
}

async function abaSupr(box, d) {
  const [p, f, al] = await Promise.all([rpc('fn_pedidos', { p_data: d }), rpc('fn_fornecedores', { p_data: d }), rpc('fn_alerta_data_limite', { p_data: d })]);
  const abertos = p.filter((x) => x.situacao.startsWith('ABERTO')); const alertas = al.filter((x) => x.situacao !== 'PEDIDO EMITIDO' && x.situacao !== 'OK');
  box.innerHTML = `<div class="cartao"><h3>Pedidos em aberto na data (${abertos.length}), atrasados primeiro</h3>${htmlTabela(abertos.sort((a, b) => b.atraso_dias - a.atraso_dias), [
      { campo: 'id_pedido', titulo: 'Pedido', t: 1 }, { campo: 'id_material', titulo: 'Material', t: 1 }, { campo: 'id_atividade', titulo: 'Atividade', t: 1 }, { campo: 'nome_fornecedor', titulo: 'Fornecedor', t: 1 },
      { campo: 'data_pedido', titulo: 'Pedido em', f: fmt.data }, { campo: 'data_prometida', titulo: 'Prometido', f: fmt.data }, { campo: 'situacao', titulo: 'Situação', t: 1, cor: (v) => (v === 'ABERTO_ATRASADO' ? 'neg' : '') },
      { campo: 'atraso_dias', titulo: 'Atraso (dias)' }])}<p class="fonte">fn_pedidos · compras_pedidos sem entrega até a data; atrasado = prometido antes da data</p></div>
    <div class="cartao" style="margin-top:12px"><h3>Desempenho por fornecedor</h3>${htmlTabela(f, [{ campo: 'nome_fornecedor', titulo: 'Fornecedor', t: 1 }, { campo: 'pedidos', titulo: 'Pedidos' },
      { campo: 'entregues_com_atraso', titulo: 'Entregues após a necessidade da obra' }, { campo: 'pct_atraso', titulo: '% com atraso', f: (v) => fmt.pct(v), cor: (v) => (v > 0.3 ? 'neg' : '') },
      { campo: 'atraso_medio_dias', titulo: 'Atraso médio (dias)', f: (v) => fmt.n(v, 1) }, { campo: 'rejeicao_fvm_pct', titulo: 'Rejeição FVM', f: (v) => fmt.pct(v) }, { campo: 'frete_expresso_rs', titulo: 'Frete expresso', f: fmt.rs }])}
      <p class="fonte">fn_fornecedores · atraso = entrega após data_necessidade_obra (linha de base)</p></div>
    <div class="cartao" style="margin-top:12px"><h3>Alerta de data-limite de pedido (${alertas.length})</h3>${alertas.length ? htmlTabela(alertas, [{ campo: 'id_material', titulo: 'Material', t: 1 },
      { campo: 'id_atividade', titulo: 'Atividade', t: 1 }, { campo: 'data_uso', titulo: 'Uso (LB)', f: fmt.data }, { campo: 'lead_time_du', titulo: 'Lead time (du)' }, { campo: 'data_limite', titulo: 'Data-limite', f: fmt.data },
      { campo: 'situacao', titulo: 'Situação', t: 1, cor: (v) => (v.startsWith('DATA') ? 'neg' : '') }]) : '<p class="nota">Nenhum material sem pedido com data-limite vencida ou próxima.</p>'}
      <p class="fonte">fn_alerta_data_limite · data de uso − lead time − margem de 5 du (D6)</p></div>`;
}

async function abaEquip(box, d) {
  const e = await rpc('fn_equipamentos', { p_ini: '2025-12-01', p_data: d });
  box.innerHTML = `<div class="cartao"><h3>Equipamentos de obra por tipo</h3>${htmlTabela(e, [{ campo: 'tipo_equipamento', titulo: 'Tipo', t: 1 }, { campo: 'descricao', titulo: 'Descrição', t: 1 },
    { campo: 'unidades', titulo: 'Unid.' }, { campo: 'diarias', titulo: 'Diárias' }, { campo: 'diarias_sem_frente', titulo: 'Diárias sem frente', cor: (v) => (v > 10 ? 'neg' : '') },
    { campo: 'disponibilidade', titulo: 'Disponibilidade', f: (v) => fmt.pct(v) }, { campo: 'utilizacao', titulo: 'Utilização', f: (v) => fmt.pct(v), cor: (v) => (v < 0.6 ? 'neg' : '') },
    { campo: 'falhas', titulo: 'Falhas' }, { campo: 'mtbf_h', titulo: 'MTBF (h)', f: (v) => fmt.n(v, 1) }, { campo: 'mttr_h', titulo: 'MTTR (h)', f: (v) => fmt.n(v, 2) },
    { campo: 'custo_diarias_sem_frente', titulo: 'Custo das diárias sem frente', f: fmt.rs }])}
    <p class="fonte">fn_equipamentos · disponibilidade = 1 − (corretiva + preventiva) ÷ horas disponíveis; MTBF = operando ÷ falhas; MTTR = corretiva ÷ falhas (Anexo D). Utilização = operando ÷ disponíveis.</p></div>`;
}

async function abaOee(box) {
  const tudo = await rpc('fn_oee', {});
  box.innerHTML = `<div class="cartao"><h3>OEE real × previsto por posto (site atual, tabela 27)</h3>${htmlTabela(tudo, [{ campo: 'id_posto', titulo: 'Posto', t: 1 }, { campo: 'nome_posto', titulo: 'Nome', t: 1 },
    { campo: 'turnos', titulo: 'Turnos apontados' }, { campo: 'disponibilidade', titulo: 'Disponibilidade', f: (v) => fmt.pct(v) }, { campo: 'eficiencia', titulo: 'Eficiência', f: (v) => fmt.pct(v) },
    { campo: 'qualidade', titulo: 'Qualidade', f: (v) => fmt.pct(v) }, { campo: 'oee', titulo: 'OEE real', f: (v) => fmt.pct(v) }, { campo: 'oee_previsto', titulo: 'OEE previsto', f: (v) => fmt.pct(v) },
    { campo: 'oee', titulo: 'Gap (p.p.)', f: (v, l) => fmt.n((v - l.oee_previsto) * 100, 1), cor: (v, l) => (v - l.oee_previsto < -0.1 ? 'neg' : '') }])}
    <p class="fonte">fn_oee · Anexo D: operando = programado − planejada − não planejada − setup; D = operando ÷ (programado − planejada); E = qtd × ciclo ÷ operando; Q = boas ÷ produzidas</p></div>
    <div class="cartao" style="margin-top:12px"><h3>OEE de um turno</h3><form class="lanc" id="fOee"><label>Data<input type="date" name="d" value="2026-09-28"></label>
      <label>Turno<input type="number" name="t" value="2" min="1" max="3"></label><label>Posto<select name="p">${tudo.map((x) => `<option ${x.id_posto === 'PT03' ? 'selected' : ''}>${x.id_posto}</option>`).join('')}</select></label>
      <div><button>Calcular</button></div></form><div id="rOee"></div></div>`;
  const f = box.querySelector('#fOee');
  const calc = async (ev) => {
    ev?.preventDefault();
    const r = await rpc('fn_oee', { p_ini: f.d.value, p_fim: f.d.value, p_posto: f.p.value, p_turno: +f.t.value });
    box.querySelector('#rOee').innerHTML = r.length ? htmlTabela(r, [{ campo: 'programado_min', titulo: 'Programado (min)' }, { campo: 'operando_min', titulo: 'Operando (min)' },
      { campo: 'disponibilidade', titulo: 'D', f: (v) => fmt.pct(v) }, { campo: 'eficiencia', titulo: 'E', f: (v) => fmt.pct(v) }, { campo: 'qualidade', titulo: 'Q', f: (v) => fmt.pct(v) },
      { campo: 'oee', titulo: 'OEE', f: (v) => '<b>' + fmt.pct(v) + '</b>' }]) : '<p class="nota">Sem apontamento para esse turno.</p>';
  };
  f.onsubmit = calc; calc();
}
