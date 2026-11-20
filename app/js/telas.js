// R3 · Telas de lançamento: RDO (mão de obra, produção, chuva), equipamentos, recebimento de material,
// saída de estoque, plano semanal e fechamento, restrições, FVS, segurança e custos.
// Cada tela é descrita por uma configuração (tabela + campos); um único motor monta o formulário.
import { sb, tabela, fmt, toast, htmlTabela } from './db.js';

const OCORR = ['', 'CHUVA', 'FALHA_EQUIPAMENTO', 'FALTA_MATERIAL', 'RETRABALHO'];
const CAUSAS = ['', 'MATERIAL', 'CHUVA', 'MAO_DE_OBRA', 'EQUIPAMENTO', 'PROJETO', 'SERVICO_ANTERIOR', 'RETRABALHO', 'PRODUTIVIDADE', 'LICENCA', 'TERCEIROS'];
const NATUREZAS = ['MAO_DE_OBRA', 'SUBCONTRATO', 'MATERIAL', 'EQUIPAMENTO', 'INDIRETO'];

let cad = null; // cadastros (atividades, funções, equipamentos, materiais...) carregados uma vez
async function cadastros() {
  if (cad) return cad;
  const [atv, fun, eq, mat, forn] = await Promise.all([
    tabela('atividades', { select: 'id_atividade,nome_atividade,codigo_eap,id_zona,unidade,encarregado', ordem: 'id_atividade' }),
    tabela('funcoes', { ordem: 'funcao' }), tabela('equipamentos', { ordem: 'id_equipamento' }),
    tabela('materiais', { ordem: 'id_material' }), tabela('fornecedores', { ordem: 'id_fornecedor' })]);
  cad = { atv, fun, eq, mat, forn, atvMap: Object.fromEntries(atv.map((a) => [a.id_atividade, a])) };
  return cad;
}
const opts = {
  atividades: () => cad.atv.map((a) => [a.id_atividade, `${a.id_atividade} · ${a.nome_atividade}`]),
  funcoes: () => cad.fun.map((f) => [f.funcao, `${f.funcao} · ${f.nome_funcao}`]),
  equipamentos: () => cad.eq.map((e) => [e.id_equipamento, `${e.id_equipamento} · ${e.descricao}`]),
  materiais: () => cad.mat.map((m) => [m.id_material, `${m.id_material} · ${m.descricao}`]),
};

// ---------------- configuração das telas
// tipo: data | int | num | txt | sel ; op: lista fixa ou nome em opts ; manter: mantém o valor após salvar
const TELAS = {
  rdo_mo: { titulo: 'RDO · mão de obra', tabela: 'rdo_mao_de_obra', ajuda: 'Uma linha por atividade × função. Hh normais = presentes × 8 h (ou menos, em jornada parcial).',
    campos: [['data', 'Data', 'data', { manter: 1 }], ['id_atividade', 'Atividade', 'sel', { op: 'atividades', manter: 1 }], ['funcao', 'Função', 'sel', { op: 'funcoes' }],
      ['efetivo_previsto', 'Previsto (pessoas)', 'int'], ['efetivo_presente', 'Presente (pessoas)', 'int'], ['horas_normais', 'Hh normais', 'num'], ['horas_extras', 'Hh extras', 'num', { padrao: 0 }]],
    validar: (r) => r.efetivo_presente > r.efetivo_previsto ? 'Presentes maior que previstos.' : r.horas_normais > r.efetivo_presente * 8 + 0.01 ? 'Hh normais maior que presentes × 8 h.' : null },
  rdo_prod: { titulo: 'RDO · produção e ocorrências', tabela: 'rdo_producao', ajuda: 'Quantidade executada no dia, na unidade da atividade. Atividades contratadas (%) informam o avanço da semana.',
    campos: [['data', 'Data', 'data', { manter: 1 }], ['id_atividade', 'Atividade', 'sel', { op: 'atividades' }], ['quantidade_executada', 'Qtd executada', 'num'],
      ['ocorrencia', 'Ocorrência', 'sel', { op: OCORR }], ['horas_perdidas_chuva', 'Hh chuva', 'num', { padrao: 0 }], ['horas_perdidas_equipamento', 'Hh equipamento', 'num', { padrao: 0 }],
      ['horas_paradas_material', 'Hh material', 'num', { padrao: 0 }], ['hh_retrabalho', 'Hh retrabalho', 'num', { padrao: 0 }], ['observacao', 'Observação', 'txt']] },
  chuva: { titulo: 'RDO · chuva do dia', especial: telaChuva },
  equip: { titulo: 'Equipamentos · apontamento diário', tabela: 'equip_apontamento', ajuda: 'Operando + corretiva + preventiva + ociosas = horas disponíveis (8 h). Atividade vazia = sem frente de trabalho.',
    campos: [['data', 'Data', 'data', { manter: 1 }], ['id_equipamento', 'Equipamento', 'sel', { op: 'equipamentos' }], ['id_atividade', 'Atividade (vazio = sem frente)', 'sel', { op: 'atividades', vazio: 1 }],
      ['horas_disponiveis', 'Horas disponíveis', 'num', { padrao: 8 }], ['horas_operando', 'Operando (h)', 'num'], ['horas_manutencao_corretiva', 'Corretiva (h)', 'num', { padrao: 0 }],
      ['horas_manutencao_preventiva', 'Preventiva (h)', 'num', { padrao: 0 }], ['horas_ociosas', 'Ociosas (h)', 'num'], ['numero_falhas', 'Falhas', 'int', { padrao: 0 }], ['horimetro', 'Horímetro', 'num']],
    validar: (r) => Math.abs(r.horas_operando + r.horas_manutencao_corretiva + r.horas_manutencao_preventiva + r.horas_ociosas - r.horas_disponiveis) > 0.05 ? 'A soma das horas não fecha com as horas disponíveis.' : null },
  receb: { titulo: 'Suprimentos · recebimento e FVM', especial: telaRecebimento },
  saida: { titulo: 'Suprimentos · requisição de material (saída)', tabela: 'estoque_movimentos', fixos: { tipo_movimento: 'SAIDA' }, ajuda: 'Material aplicado na atividade (RM). Documento no padrão RM-Axx-MAT-AAAA-Snn.',
    campos: [['data', 'Data', 'data', { manter: 1 }], ['documento', 'Documento (RM)', 'txt'], ['id_material', 'Material', 'sel', { op: 'materiais' }], ['id_atividade', 'Atividade', 'sel', { op: 'atividades' }], ['quantidade', 'Quantidade', 'num']] },
  plano: { titulo: 'Last Planner · plano da semana (segunda)', tabela: 'plano_semanal', chave: 'id_pacote', ajuda: 'Pacotes comprometidos na segunda-feira. O realizado e a causa entram no fechamento de sexta.',
    campos: [['id_pacote', 'Pacote', 'txt'], ['data_inicio_semana', 'Início da semana', 'data', { manter: 1 }], ['id_atividade', 'Atividade', 'sel', { op: 'atividades' }], ['meta_quantidade', 'Meta da semana', 'num']],
    completar: (r) => { const a = cad.atvMap[r.id_atividade] || {}; return { ...r, semana: semanaISO(r.data_inicio_semana), encarregado: a.encarregado || 'Coordenação do projeto', unidade: a.unidade, quantidade_realizada: null, concluido: null }; } },
  fechamento: { titulo: 'Last Planner · fechamento (sexta)', especial: telaFechamento },
  restricao: { titulo: 'Restrições do lookahead', tabela: 'restricoes', chave: 'id_restricao', editar: 1, ajuda: 'Para atualizar uma restrição existente, digite o código e clique em "Carregar".',
    campos: [['id_restricao', 'Restrição', 'txt'], ['id_atividade', 'Atividade', 'sel', { op: 'atividades' }], ['tipo_restricao', 'Tipo', 'sel', { op: ['PROJETO', 'MATERIAL', 'EQUIPE', 'EQUIPAMENTO', 'LICENCA'] }],
      ['responsavel', 'Responsável', 'txt'], ['data_identificacao', 'Identificação', 'data'], ['data_necessaria', 'Necessária', 'data'], ['data_remocao', 'Remoção', 'data', { vazio: 1 }],
      ['status', 'Status', 'sel', { op: ['EM_ANDAMENTO', 'BLOQUEIA', 'REMOVIDA'] }]] },
  fvs: { titulo: 'Qualidade · FVS', tabela: 'inspecoes_fvs', chave: 'id_inspecao',
    campos: [['id_inspecao', 'FVS', 'txt'], ['data', 'Data', 'data'], ['id_atividade', 'Atividade', 'sel', { op: 'atividades' }], ['lote', 'Lote', 'int'],
      ['itens_verificados', 'Itens verificados', 'int'], ['itens_reprovados', 'Itens reprovados', 'int', { padrao: 0 }], ['resultado', 'Resultado', 'sel', { op: ['APROVADO', 'REPROVADO'] }], ['hh_retrabalho_estimado', 'Hh retrabalho est.', 'num', { padrao: 0 }]],
    completar: (r) => { const a = cad.atvMap[r.id_atividade] || {}; return { ...r, id_zona: a.id_zona, encarregado: a.encarregado }; },
    validar: (r) => (r.resultado === 'APROVADO') !== (r.itens_reprovados === 0) ? 'Aprovado só com 0 itens reprovados (e reprovado com pelo menos 1).' : null },
  seguranca: { titulo: 'Segurança · ocorrências', tabela: 'ocorrencias_seguranca', chave: 'id_ocorrencia',
    campos: [['id_ocorrencia', 'Ocorrência', 'txt'], ['data', 'Data', 'data'], ['tipo', 'Tipo', 'sel', { op: ['QUASE_ACIDENTE', 'ACIDENTE_SEM_AFASTAMENTO', 'ACIDENTE_COM_AFASTAMENTO'] }],
      ['id_atividade', 'Atividade', 'sel', { op: 'atividades' }], ['funcao_envolvida', 'Função', 'sel', { op: 'funcoes' }], ['dias_perdidos', 'Dias perdidos', 'int', { padrao: 0 }],
      ['houve_hora_extra_no_dia', 'Hora extra no dia (0/1)', 'int', { padrao: 0 }], ['chuva_no_dia', 'Chuva ≥ 2 mm (0/1)', 'int', { padrao: 0 }]] },
  custos: { titulo: 'Custos · apropriação semanal', tabela: 'custos_apropriados', chave: 'id_lancamento', ajuda: 'Atividade vazia só para INDIRETO (administração local, EAP 1.9). O código da EAP é preenchido pela atividade.',
    campos: [['id_lancamento', 'Lançamento', 'txt'], ['data', 'Competência', 'data', { manter: 1 }], ['id_atividade', 'Atividade', 'sel', { op: 'atividades', vazio: 1 }],
      ['categoria', 'Natureza', 'sel', { op: NATUREZAS }], ['valor_rs', 'Valor (R$)', 'num'], ['documento', 'Documento', 'txt'], ['fornecedor', 'Fornecedor', 'txt'], ['descricao', 'Histórico', 'txt']],
    completar: (r) => ({ ...r, codigo_eap: r.id_atividade ? cad.atvMap[r.id_atividade].codigo_eap : (r.categoria === 'INDIRETO' ? '1.9' : 'DIVERSOS') }),
    validar: (r) => !r.id_atividade && r.categoria !== 'INDIRETO' ? 'Custo direto precisa de atividade (senão vira DIVERSOS).' : null },
};

export function semanaISO(iso) {
  const d = new Date(iso + 'T12:00:00'); const dia = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dia + 3);
  const ano = d.getUTCFullYear(); const j = new Date(Date.UTC(ano, 0, 4));
  const sem = 1 + Math.round(((d - j) / 864e5 - 3 + ((j.getUTCDay() + 6) % 7)) / 7);
  return `${ano}-S${String(sem).padStart(2, '0')}`;
}

// ---------------- página
export async function paginaLancamentos(alvo, { usuario }) {
  await cadastros();
  const ids = Object.keys(TELAS);
  alvo.innerHTML = `<h2>Lançamentos (semana de campo e boletins diários)</h2>
    ${usuario ? '' : '<div class="alerta">Você está como visitante. Clique em <b>Entrar</b> para lançar. Cada integrante deve usar a própria conta: o sistema grava quem lançou.</div>'}
    <div class="abas">${ids.map((k) => `<button data-t="${k}">${TELAS[k].titulo}</button>`).join('')}</div><div id="tela"></div>`;
  const abrir = async (k) => {
    alvo.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativo', b.dataset.t === k));
    const box = alvo.querySelector('#tela'); const t = TELAS[k];
    if (t.especial) return t.especial(box, usuario);
    return telaGenerica(box, t, usuario);
  };
  alvo.querySelectorAll('.abas button').forEach((b) => (b.onclick = () => abrir(b.dataset.t)));
  abrir(sessionStorage.getItem('telaAtual') || 'rdo_mo');
}

function campoHTML([nome, rotulo, tipo, o = {}], valor) {
  const v = valor ?? o.padrao ?? '';
  if (tipo === 'sel') {
    const lista = typeof o.op === 'string' ? opts[o.op]() : o.op.map((x) => [x, x || '—']);
    const vazio = o.vazio ? '<option value="">— vazio —</option>' : '';
    return `<label>${rotulo}<select name="${nome}">${vazio}${lista.map(([k, l]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  }
  const it = { data: 'date', int: 'number', num: 'number', txt: 'text' }[tipo];
  const step = tipo === 'int' ? '1' : 'any';
  return `<label>${rotulo}<input name="${nome}" type="${it}" step="${step}" value="${v}" ${tipo === 'txt' || o.vazio ? '' : 'required'}></label>`;
}

function lerForm(form, t) {
  const r = { ...(t.fixos || {}) };
  for (const [nome, , tipo] of t.campos) {
    const v = form.elements[nome].value;
    r[nome] = v === '' ? null : (tipo === 'int' ? parseInt(v, 10) : tipo === 'num' ? parseFloat(v) : v);
  }
  return t.completar ? t.completar(r) : r;
}

async function telaGenerica(box, t, usuario, valores = {}) {
  sessionStorage.setItem('telaAtual', Object.keys(TELAS).find((k) => TELAS[k] === t));
  box.innerHTML = `<div class="cartao"><h3>${t.titulo}</h3><p class="nota">${t.ajuda || ''}</p>
    <form class="lanc">${t.campos.map((c) => campoHTML(c, valores[c[0]])).join('')}
      <div class="linha">${t.editar ? '<button type="button" class="sec" id="carregar">Carregar</button>' : ''}<button ${usuario ? '' : 'disabled'}>Salvar</button></div></form></div>
    <div class="cartao" style="margin-top:12px"><h3>Últimos lançamentos feitos pelas telas</h3><div id="recentes">…</div></div>`;
  const form = box.querySelector('form');
  if (t.editar) box.querySelector('#carregar').onclick = async () => {
    const id = form.elements[t.chave].value; const { data } = await sb.from(t.tabela).select('*').eq(t.chave, id).maybeSingle();
    if (!data) return toast('Não encontrado: ' + id); telaGenerica(box, t, usuario, data);
  };
  form.onsubmit = async (ev) => {
    ev.preventDefault(); const r = lerForm(form, t);
    const aviso = t.validar && t.validar(r); if (aviso && !confirm(aviso + '\n\nSalvar mesmo assim?')) return;
    const q = t.chave ? sb.from(t.tabela).upsert(r, { onConflict: t.chave }) : sb.from(t.tabela).insert(r);
    const { error } = await q; if (error) return toast('Erro: ' + error.message, 6000);
    toast('Salvo em ' + t.tabela);
    const manter = {}; t.campos.filter((c) => c[3]?.manter).forEach((c) => (manter[c[0]] = r[c[0]]));
    telaGenerica(box, t, usuario, manter);
  };
  recentes(box.querySelector('#recentes'), t.tabela, t.campos.map((c) => c[0]), usuario);
}

async function recentes(div, tab, campos, usuario) {
  const { data, error } = await sb.from(tab).select('*').eq('origem', 'TELA').order('lancado_em', { ascending: false }).limit(15);
  if (error) { div.textContent = error.message; return; }
  if (!data.length) { div.innerHTML = '<p class="nota">Nenhum lançamento pelas telas ainda.</p>'; return; }
  const pk = data[0].id !== undefined ? 'id' : null;
  const cols = campos.map((c) => ({ campo: c, titulo: c, t: 1 })).concat([{ campo: 'lancado_por_email', titulo: 'lançado por', t: 1 }]);
  if (pk && usuario) cols.push({ campo: 'id', titulo: '', f: (v) => `<button class="perigo" data-del="${v}">apagar</button>` });
  div.innerHTML = htmlTabela(data, cols);
  div.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Apagar este lançamento?')) return;
    const { error: e } = await sb.from(tab).delete().eq('id', b.dataset.del); if (e) return toast(e.message);
    b.closest('tr').remove();
  }));
}

// ---------------- telas especiais
async function telaChuva(box, usuario) {
  box.innerHTML = `<div class="cartao"><h3>Chuva registrada no pluviômetro</h3><p class="nota">Atualiza o calendário do projeto (tabela calendario, campo chuva_mm).</p>
    <form class="lanc"><label>Data<input type="date" name="data" required></label><label>Chuva (mm)<input type="number" step="any" name="mm" required></label>
    <div><button ${usuario ? '' : 'disabled'}>Salvar</button></div></form></div>`;
  box.querySelector('form').onsubmit = async (ev) => {
    ev.preventDefault(); const f = ev.target;
    const { error } = await sb.from('calendario').update({ chuva_mm: parseFloat(f.mm.value) }).eq('data', f.data.value);
    toast(error ? 'Erro: ' + error.message : 'Chuva registrada');
  };
}

async function telaRecebimento(box, usuario) {
  const abertos = await tabela('compras_pedidos', { filtro: (q) => q.is('data_entrega', null), ordem: 'id_pedido' });
  box.innerHTML = `<div class="cartao"><h3>Recebimento e inspeção de recebimento (FVM)</h3>
    <p class="nota">Registra a entrega no pedido (compras_pedidos) e lança a ENTRADA no estoque com a quantidade aceita (pedida − rejeitada).</p>
    <form class="lanc"><label>Pedido em aberto<select name="ped">${abertos.map((p) => `<option value="${p.id_pedido}">${p.id_pedido} · ${p.id_material} · ${fmt.n(p.quantidade_pedida, 2)} · ${p.id_fornecedor}</option>`).join('')}</select></label>
    <label>Data de entrega<input type="date" name="data" required></label><label>Qtd rejeitada na FVM<input type="number" step="any" name="rej" value="0" required></label>
    <div><button ${usuario && abertos.length ? '' : 'disabled'}>Registrar recebimento</button></div></form>
    ${abertos.length ? '' : '<p class="nota">Não há pedidos em aberto.</p>'}</div>`;
  box.querySelector('form').onsubmit = async (ev) => {
    ev.preventDefault(); const f = ev.target; const p = abertos.find((x) => x.id_pedido === f.ped.value); const rej = parseFloat(f.rej.value);
    const { error: e1 } = await sb.from('compras_pedidos').update({ data_entrega: f.data.value, quantidade_rejeitada_fvm: rej }).eq('id_pedido', p.id_pedido);
    if (e1) return toast('Erro: ' + e1.message);
    const { error: e2 } = await sb.from('estoque_movimentos').insert({ data: f.data.value, id_material: p.id_material, tipo_movimento: 'ENTRADA',
      quantidade: +(p.quantidade_pedida - rej).toFixed(4), id_pedido: p.id_pedido, documento: 'NF-' + p.id_pedido });
    toast(e2 ? 'Pedido atualizado, mas a entrada falhou: ' + e2.message : 'Recebimento registrado'); telaRecebimento(box, usuario);
  };
}

async function telaFechamento(box, usuario) {
  const pacotes = await tabela('plano_semanal', { ordem: 'id_pacote' });
  const semanas = [...new Set(pacotes.map((p) => p.semana))].sort().reverse();
  box.innerHTML = `<div class="cartao"><h3>Fechamento do plano semanal</h3>
    <p class="nota">"Somar RDOs" calcula o realizado com os lançamentos de produção da semana (segunda a sexta). Concluído = realizado ≥ 97% da meta (Anexo D).</p>
    <label>Semana <select id="sem">${semanas.map((s) => `<option>${s}</option>`).join('')}</select></label><div id="lista" style="margin-top:8px"></div></div>`;
  const desenhar = async () => {
    const s = box.querySelector('#sem').value; const ps = pacotes.filter((p) => p.semana === s);
    const ini = ps[0]?.data_inicio_semana; const fim = ini ? new Date(new Date(ini + 'T12:00:00').getTime() + 4 * 864e5).toISOString().slice(0, 10) : ini;
    const prod = ini ? await tabela('rdo_producao', { select: 'id_atividade,quantidade_executada', filtro: (q) => q.gte('data', ini).lte('data', fim) }) : [];
    const soma = {}; prod.forEach((x) => (soma[x.id_atividade] = (soma[x.id_atividade] || 0) + Number(x.quantidade_executada)));
    box.querySelector('#lista').innerHTML = `<table><tr><th>Pacote</th><th class="t">Atividade</th><th>Meta</th><th>Soma dos RDOs</th><th>Realizado</th><th>Concluído</th><th>Causa</th><th></th></tr>` +
      ps.map((p) => { const sr = +(soma[p.id_atividade] || 0).toFixed(4); const real = p.quantidade_realizada ?? sr;
        return `<tr data-p="${p.id_pacote}"><td>${p.id_pacote}</td><td class="t">${p.id_atividade}</td><td>${fmt.n(p.meta_quantidade, 2)}</td><td>${fmt.n(sr, 2)}</td>
        <td><input type="number" step="any" value="${real}" style="width:90px"></td><td class="conc">${real >= 0.97 * p.meta_quantidade ? 'sim' : 'não'}</td>
        <td><select>${CAUSAS.map((c) => `<option ${c === (p.causa_nao_cumprimento || '') ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
        <td><button ${usuario ? '' : 'disabled'}>Salvar</button></td></tr>`; }).join('') + '</table>';
    box.querySelectorAll('#lista tr[data-p]').forEach((tr) => {
      const p = ps.find((x) => x.id_pacote === tr.dataset.p); const inp = tr.querySelector('input');
      inp.oninput = () => (tr.querySelector('.conc').textContent = parseFloat(inp.value) >= 0.97 * p.meta_quantidade ? 'sim' : 'não');
      tr.querySelector('button').onclick = async () => {
        const real = parseFloat(inp.value); const conc = real >= 0.97 * p.meta_quantidade ? 1 : 0; const causa = tr.querySelector('select').value || null;
        if (!conc && !causa) return toast('Pacote não concluído precisa de causa.');
        const { error } = await sb.from('plano_semanal').update({ quantidade_realizada: real, concluido: conc, causa_nao_cumprimento: conc ? null : causa }).eq('id_pacote', p.id_pacote);
        toast(error ? 'Erro: ' + error.message : `${p.id_pacote} fechado`);
      };
    });
  };
  box.querySelector('#sem').onchange = desenhar; if (semanas.length) desenhar();
}
