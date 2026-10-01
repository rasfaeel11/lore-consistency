// Código do navegador. JavaScript puro, sem build: o servidor entrega este arquivo como está.
// Todo texto que vem da história entra com textContent (nunca innerHTML), para não virar HTML.

const $ = (id) => document.getElementById(id);

let historia = { nome: "", capitulos: [], erros: 0 };
// Resumo do pack logo depois de criar uma sessão, para mostrar uma vez.
let ultimoResumo = null;

async function api(caminho, opcoes) {
  const resposta = await fetch(caminho, opcoes);
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro ?? `Erro ${resposta.status}`);
  return dados;
}

async function carregarHistoria() {
  historia = await api("/api/historia");
  $("nome-historia").textContent = historia.nome;
  document.title = `${historia.nome} · lore-pack`;

  const aviso = $("aviso-erros");
  aviso.hidden = historia.erros === 0;
  aviso.textContent = `A pasta tem ${historia.erros === 1 ? "1 erro" : `${historia.erros} erros`}. Rode "lore-pack check" no terminal para ver e corrigir.`;

  desenharBarra();
}

function desenharBarra() {
  const nav = $("capitulos");
  nav.replaceChildren();
  if (historia.capitulos.length === 0) {
    const p = document.createElement("p");
    p.className = "vazio";
    p.textContent = 'Nenhum capítulo ainda. Crie o primeiro no terminal: lore-pack capitulo novo "<título>"';
    nav.append(p);
    return;
  }

  const atual = rotaAtual();
  for (const capitulo of historia.capitulos) {
    const bloco = document.createElement("section");
    bloco.className = "capitulo";
    const titulo = document.createElement("h2");
    titulo.textContent = capitulo.titulo ? `${capitulo.id} · ${capitulo.titulo}` : `${capitulo.id} (não existe em capitulos/)`;
    bloco.append(titulo);

    const lista = document.createElement("ul");
    if (capitulo.sessoes.length === 0) {
      const vazio = document.createElement("li");
      vazio.className = "vazio";
      vazio.textContent = "nenhuma sessão";
      lista.append(vazio);
    }
    for (const sessao of capitulo.sessoes) {
      const item = document.createElement("li");
      const botao = document.createElement("button");
      botao.type = "button";
      botao.setAttribute("aria-current", String(atual.tipo === "sessao" && atual.id === sessao.id));
      const nome = document.createElement("span");
      nome.textContent = sessao.id;
      const status = document.createElement("span");
      status.className = `status ${sessao.status}`;
      status.textContent = sessao.status;
      botao.append(nome, status);
      botao.addEventListener("click", () => (location.hash = `#sessao/${sessao.id}`));
      item.append(botao);
      lista.append(item);
    }
    bloco.append(lista);
    nav.append(bloco);
  }
}

// Rotas pelo "#" do endereço: #nova, #sessao/<id> ou vazio.
function rotaAtual() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash === "nova") return { tipo: "nova" };
  if (hash.startsWith("sessao/")) return { tipo: "sessao", id: hash.slice("sessao/".length) };
  return { tipo: "inicio" };
}

function mostrar(secao) {
  for (const id of ["inicio", "nova", "sessao"]) $(id).hidden = id !== secao;
}

async function navegar() {
  const rota = rotaAtual();
  desenharBarra();
  if (rota.tipo === "nova") return mostrarNova();
  if (rota.tipo === "sessao") return mostrarSessao(rota.id);
  mostrar("inicio");
}

function mostrarNova() {
  const select = document.querySelector('#form-nova [name="capitulo"]');
  const escolhido = select.value;
  select.replaceChildren();
  // Só capítulos que existem (os sem título são sessões órfãs).
  for (const capitulo of historia.capitulos.filter((c) => c.titulo)) {
    const opcao = document.createElement("option");
    opcao.value = capitulo.id;
    opcao.textContent = `${capitulo.id} · ${capitulo.titulo}`;
    select.append(opcao);
  }
  // Padrão: o último capítulo, que costuma ser o que está sendo escrito.
  select.value = escolhido || (select.options[select.options.length - 1]?.value ?? "");
  $("erro-nova").hidden = true;
  mostrar("nova");
}

async function mostrarSessao(id) {
  let sessao;
  try {
    sessao = await api(`/api/sessoes/${encodeURIComponent(id)}`);
  } catch (erro) {
    $("inicio").querySelector("p").textContent = erro.message;
    mostrar("inicio");
    return;
  }

  $("sessao-capitulo").textContent = sessao.capitulo;
  $("sessao-id").textContent = sessao.id;
  const criada = new Date(sessao.criada_em).toLocaleString("pt-BR");
  const fechada = sessao.fechada_em ? ` · fechada em ${new Date(sessao.fechada_em).toLocaleString("pt-BR")}` : "";
  $("sessao-meta").textContent = `${sessao.status} · criada em ${criada}${fechada}`;
  $("sessao-comando").textContent = sessao.comando;
  $("sessao-corpo").textContent = sessao.corpo;
  $("copiar-pacote").disabled = sessao.pacote === null;
  $("copiado").textContent = sessao.pacote === null ? "Esta sessão não tem pacote.md." : "";

  const resumo = $("sessao-resumo-pack");
  resumo.hidden = ultimoResumo === null || ultimoResumo.id !== id;
  resumo.textContent = ultimoResumo?.texto ?? "";
  mostrar("sessao");
}

async function copiar(texto, mensagem) {
  try {
    await navigator.clipboard.writeText(texto);
    $("copiado").textContent = mensagem;
  } catch {
    $("copiado").textContent = "Não consegui copiar. Selecione o texto e copie à mão.";
  }
}

$("botao-nova").addEventListener("click", () => (location.hash = "#nova"));

$("copiar-comando").addEventListener("click", () => copiar($("sessao-comando").textContent, "Comando copiado."));

$("copiar-pacote").addEventListener("click", async () => {
  const id = rotaAtual().id;
  const resposta = await fetch(`/api/sessoes/${encodeURIComponent(id)}/pacote`);
  if (!resposta.ok) {
    $("copiado").textContent = "Não achei o pacote.md desta sessão.";
    return;
  }
  await copiar(await resposta.text(), "Pacote copiado. Cole na conversa com a IA.");
});

$("form-nova").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  const dados = new FormData(form);
  const botao = form.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    const criada = await api("/api/sessoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capitulo: dados.get("capitulo"),
        plano: dados.get("plano"),
        com: dados.get("com"),
        sem: dados.get("sem"),
        alfabeto: dados.get("alfabeto") === "on",
        semUltimaCena: dados.get("semUltimaCena") === "on",
      }),
    });
    ultimoResumo = { id: criada.id, texto: criada.resumo };
    form.reset();
    await carregarHistoria();
    location.hash = `#sessao/${criada.id}`;
  } catch (erro) {
    $("erro-nova").textContent = erro.message;
    $("erro-nova").hidden = false;
  } finally {
    botao.disabled = false;
  }
});

window.addEventListener("hashchange", navegar);

try {
  await carregarHistoria();
  await navegar();
} catch (erro) {
  $("inicio").querySelector("p").textContent = `Não consegui ler a história: ${erro.message}`;
}
