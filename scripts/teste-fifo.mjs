// Teste de ordem de chegada (FIFO). Uso (Node 18+): node scripts/teste-fifo.mjs
// Envia 120 reservas UMA APÓS A OUTRA, com um pequeno intervalo entre elas, para 100 vagas.
// Se o atendimento é por ordem de chegada, as 100 primeiras ficam com as vagas e as 20 últimas recebem POOL_CHEIO.
// Rode com o pool zerado (docker compose down -v && docker compose up --build -d).
const BASE = process.env.BASE_URL || "http://localhost:8080";
const USUARIOS = 120;
const INTERVALO_MS = 5;
const sufixo = Date.now();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamar(metodo, caminho, token, corpo) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function criarUsuario(nome) {
  await chamar("POST", "/auth/registrar", null, { username: nome, password: "senha123" });
  return (await chamar("POST", "/auth/login", null, { username: nome, password: "senha123" })).json.token;
}

console.log(`Criando ${USUARIOS} usuários e 1 pedido cada...`);
const tokens = [];
for (let i = 0; i < USUARIOS; i++) tokens.push(await criarUsuario(`f${sufixo}_${i}`));
const pedidos = [];
for (const t of tokens) pedidos.push((await chamar("POST", "/pedidos", t, { showId: 7 })).json.id);

const pool = (await chamar("GET", "/pool", tokens[0])).json;
if (pool.ocupadas !== 0) {
  console.log(`O pool não está zerado (ocupadas = ${pool.ocupadas}). Rode docker compose down -v e suba de novo.`);
  process.exit(1);
}

console.log(`Enviando as reservas em ordem, 1 a cada ${INTERVALO_MS} ms...`);
const respostas = [];
for (let i = 0; i < USUARIOS; i++) {
  respostas.push(chamar("POST", `/pedidos/${pedidos[i]}/reservar`, tokens[i]));
  await dormir(INTERVALO_MS);
}
const resultado = await Promise.all(respostas);

const vencedores = resultado.map((r, i) => (r.status === 200 ? i : -1)).filter((i) => i >= 0);
const recusados = resultado.map((r, i) => (r.status === 409 ? i : -1)).filter((i) => i >= 0);
const outros = resultado.filter((r) => r.status !== 200 && r.status !== 409).length;

const primeiros100 = vencedores.length === 100 && vencedores.every((i) => i < 100);
const ultimos20 = recusados.length === 20 && recusados.every((i) => i >= 100);

console.log(`Reservas aceitas: ${vencedores.length} | recusadas (409): ${recusados.length} | outros códigos: ${outros}`);
console.log("As 100 primeiras a chegar ficaram com as vagas?", primeiros100);
console.log("As 20 últimas a chegar receberam POOL_CHEIO?", ultimos20);
if (!primeiros100) {
  const furaram = vencedores.filter((i) => i >= 100);
  console.log("Posições >= 100 que conseguiram vaga:", furaram);
}
