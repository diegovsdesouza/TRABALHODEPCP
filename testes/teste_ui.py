from playwright.sync_api import sync_playwright
import subprocess
erros = []
def q(sql): return subprocess.run(['psql','-h','/tmp','-p','5433','-U','postgres','-d','g7','-tA','-c',sql],capture_output=True,text=True).stdout.strip()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 1000})
    pg.on('console', lambda m: m.type == 'error' and erros.append(m.text))
    pg.on('pageerror', lambda e: erros.append('PAGEERROR ' + str(e)))
    pg.goto('http://127.0.0.1:8765/#/dashboard'); pg.wait_for_selector('.kpis', timeout=20000)
    print('DASH kpis:', pg.locator('.kpi').count(), '|', pg.locator('.kpi').nth(3).inner_text().replace('\n',' '), '| charts', pg.evaluate('document.querySelectorAll("canvas").length'))
    pg.screenshot(path='dash.png', full_page=True)
    pg.goto('http://127.0.0.1:8765/#/indicadores'); pg.wait_for_selector('#aba table', timeout=20000)
    for k in ['avanco','evm','rup','hist','supr','equip']:
        pg.click(f'button[data-a="{k}"]'); pg.wait_for_timeout(1500)
        print('IND', k, 'tabelas', pg.locator('#aba table').count(), '| alerta' if pg.locator('.alerta').count() else '')
    pg.goto('http://127.0.0.1:8765/#/conferencia'); pg.wait_for_selector('table', timeout=20000)
    print('CONF', pg.locator('.ok').count(), 'ok,', pg.locator('.erro').count(), 'diverge')
    pg.goto('http://127.0.0.1:8765/#/3d'); pg.wait_for_timeout(2500); print('3D slider', pg.locator('#slider').count(), 'erro' if pg.locator('.alerta').count() else '')
    # lançamento RDO MO (boletim B2, 1ª linha)
    pg.goto('http://127.0.0.1:8765/#/lancamentos'); pg.wait_for_selector('form.lanc', timeout=20000)
    pg.click('button[data-t="rdo_mo"]'); pg.wait_for_selector('form.lanc')
    f = pg.locator('form.lanc')
    f.locator('input[name=data]').fill('2026-11-09'); f.locator('select[name=id_atividade]').select_option('A16'); f.locator('select[name=funcao]').select_option('PIN')
    f.locator('input[name=efetivo_previsto]').fill('15'); f.locator('input[name=efetivo_presente]').fill('13'); f.locator('input[name=horas_normais]').fill('104'); f.locator('input[name=horas_extras]').fill('0')
    f.locator('button:has-text("Salvar")').click(); pg.wait_for_timeout(1500)
    print('RDO salvo:', q("select count(*) from rdo_mao_de_obra where origem='TELA'"), '| data mantida:', pg.locator('form.lanc input[name=data]').input_value())
    # produção
    pg.click('button[data-t="rdo_prod"]'); pg.wait_for_selector('form.lanc select[name=ocorrencia]'); f = pg.locator('form.lanc')
    f.locator('input[name=data]').fill('2026-11-09'); f.locator('select[name=id_atividade]').select_option('A16'); f.locator('input[name=quantidade_executada]').fill('260.5')
    f.locator('button:has-text("Salvar")').click(); pg.wait_for_timeout(1500); print('PROD salvo:', q("select count(*) from rdo_producao where origem='TELA'"))
    # plano semanal + fechamento
    pg.click('button[data-t="plano"]'); pg.wait_for_selector('form.lanc input[name=id_pacote]'); f = pg.locator('form.lanc')
    f.locator('input[name=id_pacote]').fill('PK0220'); f.locator('input[name=data_inicio_semana]').fill('2026-11-09'); f.locator('select[name=id_atividade]').select_option('A16'); f.locator('input[name=meta_quantidade]').fill('1523')
    f.locator('button:has-text("Salvar")').click(); pg.wait_for_timeout(1500); print('PLANO:', q("select semana,encarregado,unidade from plano_semanal where id_pacote='PK0220'"))
    pg.click('button[data-t="fechamento"]'); pg.wait_for_selector('#lista table', timeout=10000)
    print('FECH semana:', pg.locator('#sem').input_value(), '| linha PK0220 soma:', pg.locator('tr[data-p="PK0220"] td').nth(3).inner_text())
    # recebimento
    pg.click('button[data-t="receb"]'); pg.wait_for_selector('select[name=ped]'); pg.locator('input[name=data]').fill('2026-11-10'); pg.locator('select[name=ped]').select_option('PC0177')
    pg.locator('button:has-text("Registrar")').click(); pg.wait_for_timeout(1500); print('RECEB:', q("select data_entrega from compras_pedidos where id_pedido='PC0177'"), q("select quantidade from estoque_movimentos where id_pedido='PC0177'"))
    # restrição: carregar e editar
    pg.click('button[data-t="restricao"]'); pg.wait_for_selector('#carregar'); pg.locator('input[name=id_restricao]').fill('R057'); pg.click('#carregar'); pg.wait_for_timeout(1500)
    print('RESTR carregada atividade:', pg.locator('select[name=id_atividade]').input_value(), pg.locator('select[name=status]').input_value())
    for k in ['equip','saida','fvs','seguranca','custos','chuva']:
        pg.click(f'button[data-t="{k}"]'); pg.wait_for_timeout(800); print('TELA', k, 'campos', pg.locator('#tela input, #tela select').count())
    pg.screenshot(path='lanc.png', full_page=True)
    b.close()
print('ERROS:', erros[:10])
