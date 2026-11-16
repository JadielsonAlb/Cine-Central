// ---------------------------------------------------------------
// Filmes em cartaz. Para trocar por um filme real:
//   1) salve o cartaz em public/img/ (ex.: public/img/meu-filme.jpg)
//   2) preencha "imagem" com "img/meu-filme.jpg" e ajuste os textos
// O "showId" é o número que a API recebe em POST /pedidos.
// ---------------------------------------------------------------
const FILMES = [
  {
    showId: 1,
    titulo: "O Último Trem",
    genero: "Suspense",
    duracao: "1h52",
    classificacao: "14 anos",
    sinopse: "Uma viagem noturna de trem muda de rumo quando os passageiros percebem que ninguém sabe quem está conduzindo.",
    imagem: ""
  },
  {
    showId: 2,
    titulo: "Verão em Olinda",
    genero: "Comédia romântica",
    duracao: "1h38",
    classificacao: "12 anos",
    sinopse: "Duas amigas de infância se reencontram durante o Carnaval e descobrem que ainda gostam da mesma pessoa.",
    imagem: ""
  },
  {
    showId: 3,
    titulo: "Casa de Vidro",
    genero: "Terror",
    duracao: "1h45",
    classificacao: "16 anos",
    sinopse: "Uma família se muda para uma casa onde todas as paredes são transparentes, menos uma.",
    imagem: ""
  },
  {
    showId: 4,
    titulo: "Pequenos Gigantes",
    genero: "Animação",
    duracao: "1h30",
    classificacao: "Livre",
    sinopse: "Um grupo de formigas precisa atravessar o quintal inteiro para salvar a colônia antes da chuva.",
    imagem: ""
  }
];

const $ = (id) => document.getElementById(id);

const estado = {
  token: localStorage.getItem("token"),
  usuario: localStorage.getItem("usuario"),
  ingressos: [],
  timer: null
};

// ---------- utilidades ----------

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function mostrarAviso(span, texto, tipo) {
  span.textContent = texto;
  span.className = "aviso aviso-" + tipo;
  span.hidden = false;
}

async function api(metodo, caminho, corpo) {
  const headers = { "Content-Type": "application/json" };
  if (estado.token) headers["Authorization"] = "Bearer " + estado.token;

  const resposta = await fetch(caminho, {
    method: metodo,
    headers,
    body: corpo ? JSON.stringify(corpo) : undefined
  });

  let dados = null;
  try { dados = await resposta.json(); } catch (e) { /* resposta sem corpo */ }
  return { status: resposta.status, dados };
}

function tituloDoFilme(showId) {
  const filme = FILMES.find((f) => f.showId === showId);
  return filme ? filme.titulo : "Show " + showId;
}

// A lista de ingressos vem do banco (GET /pedidos): só os pedidos RESERVADO
async function carregarIngressos() {
  const r = await api("GET", "/pedidos");
  if (r.status === 401) return sessaoExpirada();
  if (r.status !== 200 || !Array.isArray(r.dados)) return;

  estado.ingressos = r.dados
    .filter((p) => p.status === "RESERVADO")
    .map((p) => ({ id: p.id, titulo: tituloDoFilme(p.showId) }));
  desenharIngressos();
}

// ---------- login ----------

async function entrar() {
  const aviso = $("aviso-login");
  const username = $("campo-usuario").value.trim();
  const password = $("campo-senha").value;

  if (!username || !password) {
    mostrarAviso(aviso, "Preencha usuário e senha.", "info");
    return;
  }

  const r = await api("POST", "/auth/login", { username, password });

  if (r.status === 200 && r.dados && r.dados.token) {
    estado.token = r.dados.token;
    estado.usuario = username;
    localStorage.setItem("token", estado.token);
    localStorage.setItem("usuario", estado.usuario);
    $("campo-senha").value = "";
    aviso.hidden = true;
    mostrarFilmes();
  } else if (r.status === 401 || r.status === 404) {
    mostrarAviso(aviso, "Usuário ou senha incorretos.", "esgotado");
  } else {
    mostrarAviso(aviso, "Não foi possível entrar. Tente novamente.", "esgotado");
  }
}

async function criarConta() {
  const aviso = $("aviso-login");
  const username = $("campo-usuario").value.trim();
  const password = $("campo-senha").value;

  if (!username || !password) {
    mostrarAviso(aviso, "Preencha usuário e senha.", "info");
    return;
  }

  const r = await api("POST", "/auth/registrar", { username, password });

  if (r.status === 201) {
    await entrar();
  } else if (r.status === 409) {
    mostrarAviso(aviso, "Este nome de usuário já existe.", "esgotado");
  } else {
    mostrarAviso(aviso, "Não foi possível criar a conta.", "esgotado");
  }
}

function sair(mensagem) {
  clearInterval(estado.timer);
  estado.token = null;
  estado.usuario = null;
  estado.ingressos = [];
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  mostrarLogin();
  if (mensagem) mostrarAviso($("aviso-login"), mensagem, "info");
}

function sessaoExpirada() {
  sair("Sua sessão expirou. Entre novamente.");
}

// ---------- telas ----------

function mostrarLogin() {
  $("tela-filmes").hidden = true;
  $("sessao").hidden = true;
  $("tela-login").hidden = false;
}

function mostrarFilmes() {
  $("tela-login").hidden = true;
  $("tela-filmes").hidden = false;
  $("sessao").hidden = false;
  $("nome-usuario").textContent = estado.usuario;

  desenharFilmes();
  carregarIngressos();
  atualizarPool();

  clearInterval(estado.timer);
  estado.timer = setInterval(atualizarPool, 5000);
}

// ---------- pool ----------

async function atualizarPool() {
  const r = await api("GET", "/pool");
  if (r.status === 401) return sessaoExpirada();
  if (r.status !== 200 || !r.dados) return;

  const { total, livres } = r.dados;
  $("info-pool").textContent = "Ingressos disponíveis: " + livres + " de " + total;

  const aviso = $("aviso-geral");
  if (livres === 0) {
    mostrarAviso(aviso, "Os ingressos foram esgotados.", "esgotado");
  } else {
    aviso.hidden = true;
  }
}

// ---------- filmes e compra ----------

function desenharFilmes() {
  const lista = $("lista-filmes");
  lista.replaceChildren();

  for (const filme of FILMES) {
    const item = el("article", "filme");

    let poster;
    if (filme.imagem) {
      poster = el("img", "poster");
      poster.src = filme.imagem;
      poster.alt = "Cartaz de " + filme.titulo;
    } else {
      poster = el("div", "poster-vazio", filme.titulo);
    }

    const info = el("div");
    info.append(
      el("h3", "", filme.titulo),
      el("p", "dados", [filme.genero, filme.duracao, filme.classificacao].join(" · ")),
      el("p", "sinopse", filme.sinopse)
    );

    const botao = el("button", "botao botao-primario", "Comprar ingresso");
    botao.type = "button";
    const aviso = el("span", "aviso");
    aviso.setAttribute("role", "status");
    aviso.hidden = true;

    botao.addEventListener("click", () => comprar(filme, botao, aviso));

    info.append(botao, aviso);
    item.append(poster, info);
    lista.append(item);
  }
}

async function comprar(filme, botao, aviso) {
  botao.disabled = true;
  mostrarAviso(aviso, "Processando...", "info");

  try {
    // 1) coloca o ingresso no carrinho
    const pedido = await api("POST", "/pedidos", { showId: filme.showId });
    if (pedido.status === 401) return sessaoExpirada();
    if (pedido.status !== 201 || !pedido.dados) {
      mostrarAviso(aviso, "Não foi possível iniciar a compra. Tente novamente.", "esgotado");
      return;
    }

    // 2) tenta reservar (é aqui que acontece a disputa pelas vagas)
    const reserva = await api("POST", "/pedidos/" + pedido.dados.id + "/reservar");

    if (reserva.status === 200) {
      await carregarIngressos();
      mostrarAviso(aviso, "Ingresso reservado para " + filme.titulo + ". Pedido nº " + pedido.dados.id + ".", "ok");
    } else if (reserva.status === 409 && reserva.dados && reserva.dados.error === "POOL_CHEIO") {
      mostrarAviso(aviso, "Os ingressos foram esgotados.", "esgotado");
    } else if (reserva.status === 409 && reserva.dados && reserva.dados.error === "COTA_PESSOAL") {
      mostrarAviso(aviso, "Você já tem 2 ingressos. Cancele um para comprar outro.", "esgotado");
    } else if (reserva.status === 401) {
      return sessaoExpirada();
    } else {
      mostrarAviso(aviso, "Não foi possível concluir a compra. Tente novamente.", "esgotado");
    }
  } catch (erro) {
    mostrarAviso(aviso, "Sem conexão com o servidor.", "esgotado");
  } finally {
    botao.disabled = false;
    atualizarPool();
  }
}

// ---------- seus ingressos ----------

function desenharIngressos() {
  const lista = $("lista-ingressos");
  lista.replaceChildren();
  $("sem-ingressos").hidden = estado.ingressos.length > 0;

  for (const ing of estado.ingressos) {
    const li = el("li");
    li.append(el("span", "", ing.titulo + " · pedido nº " + ing.id));

    const botao = el("button", "botao botao-secundario", "Cancelar");
    botao.type = "button";
    botao.addEventListener("click", () => cancelar(ing, botao));
    li.append(botao);
    lista.append(li);
  }
}

async function cancelar(ing, botao) {
  const aviso = $("aviso-ingressos");
  botao.disabled = true;

  const r = await api("POST", "/pedidos/" + ing.id + "/cancelar");
  if (r.status === 401) return sessaoExpirada();

  if (r.status === 200) {
    mostrarAviso(aviso, "Ingresso cancelado. A vaga voltou para o pool.", "ok");
  } else {
    // 404/409 ou erro: NÃO damos o ingresso como cancelado; a lista é recarregada do banco
    mostrarAviso(aviso, "Não foi possível cancelar este ingresso.", "esgotado");
  }

  await carregarIngressos();
  atualizarPool();
}

// ---------- início ----------

$("form-login").addEventListener("submit", (e) => { e.preventDefault(); entrar(); });
$("btn-criar").addEventListener("click", criarConta);
$("btn-sair").addEventListener("click", () => sair());

if (estado.token && estado.usuario) {
  mostrarFilmes();
} else {
  mostrarLogin();
}
