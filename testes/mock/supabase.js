// Mock do supabase-js para teste local: repassa consultas a um servidor que roda no Postgres local
async function post(url, body) { const r = await fetch(url, { method: 'POST', body: JSON.stringify(body) }); return r.json(); }
class Q {
  constructor(t) { this.s = { table: t, method: 'select', select: '*', filters: [], order: null, range: null, limit: null, single: false }; }
  select(c = '*') { if (this.s.method === 'select') this.s.select = c; return this; }
  eq(c, v) { this.s.filters.push(['=', c, v]); return this; } is(c, v) { this.s.filters.push(['is', c, v]); return this; }
  gte(c, v) { this.s.filters.push(['>=', c, v]); return this; } lte(c, v) { this.s.filters.push(['<=', c, v]); return this; }
  order(c, o = {}) { this.s.order = [c, o.ascending !== false]; return this; } range(a, b) { this.s.range = [a, b]; return this; }
  limit(n) { this.s.limit = n; return this; } maybeSingle() { this.s.single = true; return this; }
  insert(b) { this.s.method = 'insert'; this.s.body = b; return this; } upsert(b, o) { this.s.method = 'upsert'; this.s.body = b; this.s.conflict = o?.onConflict; return this; }
  update(b) { this.s.method = 'update'; this.s.body = b; return this; } delete() { this.s.method = 'delete'; return this; }
  then(ok, ko) { return post('/q', this.s).then(ok, ko); }
}
export function createClient() {
  const user = { email: 'teste@g7.local', id: '00000000-0000-0000-0000-000000000001' };
  return {
    from: (t) => new Q(t), rpc: (n, a) => post('/rpc/' + n, a || {}).then((r) => (r && r.__erro ? { data: null, error: { message: r.__erro } } : { data: r, error: null })),
    auth: { getSession: async () => ({ data: { session: { user } } }), onAuthStateChange: () => {}, signOut: async () => {}, signInWithPassword: async () => ({}), signUp: async () => ({}) },
  };
}
