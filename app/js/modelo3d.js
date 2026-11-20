// R12 · Modelo 3D navegável (Three.js): zonas da tabela 13 coloridas pelo avanço, controle deslizante de data
// e clique na zona mostrando as atividades. Avanço da zona = média ponderada pelo custo orçado (fn_zonas, Anexo B).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rpc, fmt, dataCorte } from './db.js';

let renderer = null, frame = null;
const cache = {};

function corAvanco(av, planejado, criticaAtrasada) {
  if (av == null) return new THREE.Color('#b0b8c1');           // zona sem atividade
  if (criticaAtrasada) return new THREE.Color('#d32f2f');      // crítica atrasada: vermelho
  const c = new THREE.Color();                                  // 0% laranja → 100% verde
  return c.setHSL(0.08 + 0.25 * av, 0.75, 0.5);
}

function sextas() {
  const out = []; const d = new Date('2025-12-05T12:00:00Z');
  while (d <= new Date('2027-01-15T12:00:00Z')) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 7); }
  return out;
}

export async function paginaModelo3D(alvo) {
  if (renderer) { cancelAnimationFrame(frame); renderer.dispose(); renderer = null; }
  const datas = sextas(); const corte = dataCorte();
  let idx = datas.findIndex((d) => d >= corte); if (idx < 0) idx = datas.length - 1;
  alvo.innerHTML = `<h2>Modelo 3D do empreendimento</h2>
    <div class="cartao">
      <div class="linha" style="align-items:center"><label style="flex:1">Data: <b id="lblData"></b>
        <input type="range" id="slider" min="0" max="${datas.length - 1}" value="${idx}" style="width:100%"></label>
        <button class="sec" id="play">▶ Animar</button></div>
      <div class="legenda3d"><i style="background:hsl(29,75%,50%)"></i>0% <i style="background:hsl(60,75%,50%)"></i>50% <i style="background:hsl(119,75%,50%)"></i>100%
        <i style="background:#d32f2f"></i>crítica atrasada (≥ 10 p.p.) <i style="background:#b0b8c1"></i>sem atividade · a altura das zonas sobe com o avanço</div>
      <div id="cena3d"><div class="painelZona" id="painel"></div></div>
      <p class="fonte">fn_zonas(data) · geometria: layout_zonas (tabela 13) · mouse: girar (esquerdo), arrastar (direito), aproximar (roda) · clique numa zona para ver as atividades</p>
    </div>`;
  const box = alvo.querySelector('#cena3d'); const painel = alvo.querySelector('#painel');
  const cena = new THREE.Scene(); cena.background = new THREE.Color('#dfe8f1');
  const cam = new THREE.PerspectiveCamera(45, box.clientWidth / box.clientHeight, 1, 2000);
  cam.position.set(105, 180, 260);
  renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(box.clientWidth, box.clientHeight); box.prepend(renderer.domElement);
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.set(105, 0, -92); ctl.update();
  cena.add(new THREE.AmbientLight(0xffffff, 0.7)); const sol = new THREE.DirectionalLight(0xffffff, 0.8); sol.position.set(100, 300, 100); cena.add(sol);

  const zonas = await obter(datas[idx]);
  const malhas = {};
  for (const z of zonas) {
    const terreno = z.tipo_zona === 'TERRENO'; const envoltoria = z.tipo_zona === 'EDIFICACAO';
    const h = terreno ? 0.3 : Math.max(0.3, Number(z.altura_m));
    const geo = new THREE.BoxGeometry(Number(z.largura_x_m), 1, Number(z.comprimento_y_m));
    const mat = new THREE.MeshLambertMaterial({ transparent: envoltoria || terreno, opacity: envoltoria ? 0.15 : terreno ? 0.9 : 1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Number(z.x_m) + z.largura_x_m / 2, 0, -(Number(z.y_m) + z.comprimento_y_m / 2));
    m.userData = { id: z.id_zona, hMax: h, fixo: terreno || envoltoria };
    if (!terreno) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x333333 })));
    cena.add(m); malhas[z.id_zona] = m;
  }
  const aplicar = (zs) => {
    for (const z of zs) {
      const m = malhas[z.id_zona]; if (!m) continue; m.userData.z = z;
      const av = z.avanco == null ? null : Number(z.avanco);
      m.material.color = z.tipo_zona === 'TERRENO' ? new THREE.Color('#a5c47f') : z.tipo_zona === 'EDIFICACAO' ? new THREE.Color('#5c6bc0') : corAvanco(av, z.pct_planejado, z.critica_atrasada);
      const alt = m.userData.fixo ? m.userData.hMax : Math.max(0.3, m.userData.hMax * (av ?? 1));
      m.scale.y = alt; m.position.y = alt / 2;
    }
  };
  aplicar(zonas);
  const lbl = alvo.querySelector('#lblData'); lbl.textContent = fmt.data(datas[idx]);
  const slider = alvo.querySelector('#slider');
  slider.oninput = async () => { const d = datas[+slider.value]; lbl.textContent = fmt.data(d); aplicar(await obter(d)); };
  let anim = null; alvo.querySelector('#play').onclick = (ev) => {
    if (anim) { clearInterval(anim); anim = null; ev.target.textContent = '▶ Animar'; return; }
    ev.target.textContent = '⏸ Parar'; slider.value = 0;
    anim = setInterval(async () => { if (+slider.value >= datas.length - 1) { clearInterval(anim); anim = null; ev.target.textContent = '▶ Animar'; return; } slider.value = +slider.value + 1; await slider.oninput(); }, 400);
  };
  // clique numa zona
  const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('click', (ev) => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, cam);
    const hit = ray.intersectObjects(Object.values(malhas).filter((m) => m.userData.id !== 'TERRENO' && m.userData.id !== 'GALPAO'), false)[0]
      || ray.intersectObjects(Object.values(malhas), false)[0];
    if (!hit) { painel.style.display = 'none'; return; }
    const z = hit.object.userData.z;
    painel.style.display = 'block';
    painel.innerHTML = `<b>${z.id_zona} · ${z.nome_zona}</b><br>Avanço: <b>${fmt.pct(z.avanco)}</b> · planejado ${fmt.pct(z.pct_planejado)}
      ${z.critica_atrasada ? '<br><span class="erro">Crítica atrasada</span>' : ''}
      <table style="margin-top:6px"><tr><th class="t">Atividade</th><th>Real</th><th>Plan.</th></tr>${(z.atividades || []).map((a) =>
        `<tr><td class="t">${a.critica ? '🔴 ' : ''}${a.id} · ${a.nome}</td><td>${fmt.pct(a.avanco, 0)}</td><td>${fmt.pct(a.planejado, 0)}</td></tr>`).join('') || '<tr><td colspan=3>sem atividades</td></tr>'}</table>`;
  });
  const loop = () => { frame = requestAnimationFrame(loop); renderer.render(cena, cam); }; loop();
  window.addEventListener('resize', () => { if (!renderer) return; cam.aspect = box.clientWidth / box.clientHeight; cam.updateProjectionMatrix(); renderer.setSize(box.clientWidth, box.clientHeight); });
}

async function obter(d) { return (cache[d] ||= await rpc('fn_zonas', { p_data: d })); }
