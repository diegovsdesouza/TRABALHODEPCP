import http.server, json, subprocess, os, re
APP = '/home/claude/repo/TRABALHODEPCP/app'; MOCK = '/home/claude/teste/mock'
ESCALAR = {'fn_kpis'}
def psql(sql):
    r = subprocess.run(['psql', '-h', '/tmp', '-p', '5433', '-U', 'postgres', '-d', 'g7', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', sql], capture_output=True, text=True)
    if r.returncode: raise Exception(r.stderr.strip())
    return r.stdout.strip()
def lit(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return repr(v)
    return "'" + str(v).replace("'", "''") + "'"
ident = lambda s: '"' + re.sub(r'[^a-z0-9_]', '', s) + '"'
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def _json(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        p = self.path.split('?')[0]
        if p.startswith('/mock/'): f = os.path.join(MOCK, p[6:])
        else: f = os.path.join(APP, p.lstrip('/') or 'index.html')
        if os.path.isdir(f): f = os.path.join(f, 'index.html')
        if not os.path.exists(f): self.send_response(404); self.end_headers(); return
        data = open(f, 'rb').read()
        if f.endswith('index.html'):
            s = data.decode()
            s = re.sub(r'"@supabase/supabase-js": "[^"]+"', '"@supabase/supabase-js": "/mock/supabase.js"', s)
            s = re.sub(r'"chart.js": "[^"]+"', '"chart.js": "/mock/chart.js"', s)
            s = re.sub(r'"three": "[^"]+"', '"three": "/mock/three.js", "three/addons/controls/OrbitControls.js": "/mock/three.js"', s)
            data = s.encode()
        self.send_response(200); self.send_header('Content-Type', 'text/html' if f.endswith('.html') else 'text/css' if f.endswith('.css') else 'text/javascript'); self.end_headers(); self.wfile.write(data)
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])) or '{}')
        try:
            if self.path.startswith('/rpc/'):
                fn = re.sub(r'[^a-z_]', '', self.path[5:]); args = ','.join(f'{k} => {lit(v)}' for k, v in body.items())
                sql = f'select public.{fn}({args})' if fn in ESCALAR else f"select coalesce(json_agg(t),'[]') from public.{fn}({args}) t"
                return self._json(json.loads(psql(sql)))
            s = body; t = 'public.' + ident(s['table']); w = []
            for op, c, v in s['filters']:
                w.append(f"{ident(c)} is null" if op == 'is' else f"{ident(c)} {op} {lit(v)}")
            where = (' where ' + ' and '.join(w)) if w else ''
            if s['method'] == 'select':
                sql = f"select * from {t}{where}" + (f" order by {ident(s['order'][0])} {'asc' if s['order'][1] else 'desc'}" if s['order'] else '')
                if s['range']: sql += f" offset {s['range'][0]} limit {s['range'][1]-s['range'][0]+1}"
                if s['limit']: sql += f" limit {s['limit']}"
                out = json.loads(psql(f"select coalesce(json_agg(x),'[]') from ({sql}) x"))
                return self._json({'data': (out[0] if out else None) if s['single'] else out, 'error': None})
            if s['method'] in ('insert', 'upsert'):
                rows = s['body'] if isinstance(s['body'], list) else [s['body']]; cols = list(rows[0].keys())
                vals = ','.join('(' + ','.join(lit(r[c]) for c in cols) + ')' for r in rows)
                sql = f"insert into {t} ({','.join(ident(c) for c in cols)}) values {vals}"
                if s['method'] == 'upsert':
                    sql += f" on conflict ({ident(s['conflict'])}) do update set " + ','.join(f'{ident(c)}=excluded.{ident(c)}' for c in cols)
            elif s['method'] == 'update':
                sql = f"update {t} set " + ','.join(f'{ident(c)}={lit(v)}' for c, v in s['body'].items()) + where
            else:
                sql = f"delete from {t}{where}"
            psql(sql); return self._json({'data': None, 'error': None})
        except Exception as e:
            if self.path.startswith('/rpc/'): return self._json({'__erro': str(e)})
            return self._json({'data': None, 'error': {'message': str(e)}})
http.server.ThreadingHTTPServer(('127.0.0.1', 8765), H).serve_forever()
