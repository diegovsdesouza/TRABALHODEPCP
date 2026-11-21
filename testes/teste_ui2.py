from playwright.sync_api import sync_playwright
erros = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 1000})
    pg.on('console', lambda m: m.type == 'error' and erros.append(m.text)); pg.on('pageerror', lambda e: erros.append('PE ' + str(e)))
    pg.goto('http://127.0.0.1:8765/#/dashboard'); pg.wait_for_selector('.kpis', timeout=30000)
    print('DASH', pg.locator('.kpi').nth(0).inner_text().replace('\n', ' | '), '##', pg.locator('.kpi').nth(1).inner_text().replace('\n', ' | '))
    pg.goto('http://127.0.0.1:8765/#/prazo'); pg.wait_for_selector('#resM1 table', timeout=30000)
    print('PRAZO', pg.locator('.alerta').inner_text()); print('M1', pg.locator('#resM1 p').first.inner_text())
    print('KPIs', [pg.locator('.kpi b').nth(i).inner_text() for i in range(6)])
    pg.screenshot(path='prazo.png', full_page=False)
    pg.goto('http://127.0.0.1:8765/#/indicadores'); pg.wait_for_selector('button[data-a="oee"]', timeout=20000); pg.click('button[data-a="oee"]'); pg.wait_for_selector('#rOee table', timeout=20000)
    print('OEE turno', pg.locator('#rOee td').last.inner_text())
    pg.goto('http://127.0.0.1:8765/#/conferencia'); pg.wait_for_selector('table', timeout=30000); pg.wait_for_timeout(2000)
    rows = pg.locator('table').nth(1).locator('tr'); print('CADERNO'); [print('  ', rows.nth(i).inner_text().replace('\t', ' | ')) for i in range(1, rows.count())]
    b.close()
print('ERROS', erros)
