// Uso (Node 18+): node scripts/teste-concorrencia.mjs
const BASE = process.env.BASE_URL || "http://localhost:8080";
const USUARIOS = 120;
const sufixo = Date.now();

async function chamar(metodo, caminho, token, corpo) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, json, lote: r.headers.get("x-lote") };
}

async function criarUsuario(nome) {
  await chamar("POST", "/auth/registrar", null, { username: nome, password: "senha123" });
  const { json } = await chamar("POST", "/auth/login", null, { username: nome, password: "senha123" });
  return json.token;
}

function contar(lista) {
  const c = {};
  for (const r of lista) {
    const chave = `${r.status} ${r.json?.error ?? r.json?.status ?? ""}`.trim();
    c[chave] = (c[chave] || 0) + 1;
  }
  return c;
}

console.log(`Criando ${USUARIOS} usuários e 1 pedido cada...`);
const tokens = [];
for (let i = 0; i < USUARIOS; i++) tokens.push(await criarUsuario(`u${sufixo}_${i}`));
const pedidos = [];
for (const t of tokens) pedidos.push((await chamar("POST", "/pedidos", t, { showId: 7 })).json.id);

console.log("Disparando todas as reservas AO MESMO TEMPO...");
const ini = Date.now();
const resp = await Promise.all(tokens.map((t, i) => chamar("POST", `/pedidos/${pedidos[i]}/reservar`, t)));
console.log(`Tempo total: ${Date.now() - ini} ms`);
console.log("Resultados:", contar(resp));
console.log("Todos os 200 com X-Lote 7F3A?", resp.filter(r => r.status === 200).every(r => r.lote === "7F3A"));

const pool = (await chamar("GET", "/pool", tokens[0])).json;
console.log("GET /pool:", pool, "| ocupadas + livres = total?", pool.ocupadas + pool.livres === pool.total);