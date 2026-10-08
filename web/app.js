// Código do navegador. JavaScript puro, sem build: o servidor entrega este arquivo como está.
// Todo texto que vem da história entra com textContent (nunca innerHTML), para não virar HTML.

const $ = (id) => document.getElementById(id);

let historia = { nome: "", pasta: "", capitulos: [], referencias: [], erros: 0, avisos: 0 };
// Resumo do pack logo depois de criar uma sessão, para mostrar uma vez.
let ultimoResumo = null;

// O token vem no endereço que o "lore-pack ui" imprimiu. Vai no cabeçalho de todo pedido à API.
const TOKEN = new URLSearchParams(location.search).get("token") ?? "";

function pedir(caminho, opcoes = {}) {
  return fetch(caminho, { ...opcoes, headers: { ...opcoes.headers, "X-Lore-Pack-Token": TOKEN } });
}

async function api(caminho, opcoes) {
  const resposta = await pedir(caminho, opcoes);
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro ?? `Erro ${resposta.status}`);
  return dados;
}

async function carregarHistoria() {
  historia = await api("/api/historia");
  $("nome-historia").textContent = historia.nome;
  document.title = `${historia.nome} · lore-pack`;

  $("abrir-pasta").title = historia.pasta;
  // Erro trava o pack; aviso não trava, mas também aparece e também dá para pedir a correção.
  const erros = historia.erros === 1 ? "1 erro" : `${historia.erros} erros`;
  const avisos = historia.avisos === 1 ? "1 aviso" : `${historia.avisos} avisos`;
  const tem = historia.erros + historia.avisos > 0;
  const aviso = $("aviso-erros");
  aviso.hidden = !tem;
  aviso.className = historia.erros > 0 ? "aviso" : "dica";
  aviso.textContent = `O check achou ${erros} e ${avisos} na pasta.`;
  $("botao-problemas").hidden = !tem;

  desenharBarra();
}

function desenharBarra() {
  const nav = $("capitulos");
  nav.replaceChildren();
  if (historia.capitulos.length === 0) {
    const p = document.createElement("p");
    p.className = "vazio";
    p.textContent = 'Nenhum capítulo ainda. Crie o primeiro em "+ Novo capítulo".';
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

// Dono dos terminais da correção do check, igual ao FIX_ID do servidor. Não é id de sessão.
const CORRECAO = "correcao";

// Dono dos terminais da conversa fora de sessão, igual ao TALK_ID do servidor.
const CONVERSA = "conversa";

// Rotas pelo "#" do endereço: #nova, #problemas, #conversa, #instrucoes, #sessao/<id> ou vazio.
// O id é o dono dos terminais da tela: a sessão, a correção do check ou a conversa.
function rotaAtual() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash === "nova") return { tipo: "nova" };
  if (hash === "problemas") return { tipo: "problemas", id: CORRECAO };
  if (hash === "conversa") return { tipo: "conversa", id: CONVERSA };
  if (hash === "instrucoes") return { tipo: "instrucoes" };
  if (hash.startsWith("sessao/")) return { tipo: "sessao", id: hash.slice("sessao/".length) };
  return { tipo: "inicio" };
}

function mostrar(secao) {
  for (const id of ["inicio", "nova", "problemas", "instrucoes", "conversa", "sessao"]) $(id).hidden = id !== secao;
  // O painel do terminal é um só: vai para a tela que está aberta (sessão, problemas ou conversa).
  if (secao === "sessao" || secao === "problemas" || secao === "conversa") $(secao).append($("painel-terminal"));
}

async function navegar() {
  const rota = rotaAtual();
  desenharBarra();
  if (rota.tipo === "nova") return mostrarNova();
  if (rota.tipo === "problemas") return mostrarProblemas();
  if (rota.tipo === "conversa") return mostrarConversa();
  if (rota.tipo === "instrucoes") return mostrarInstrucoes();
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
  desenharReferencias();
  $("erro-nova").hidden = true;
  $("pacote-avulso").hidden = true;
  mostrar("nova");
}

// Uma caixa de seleção por referência. Mantém marcadas as que já estavam.
function desenharReferencias() {
  const lista = $("lista-referencias");
  const marcadas = new Set(new FormData($("form-nova")).getAll("referencias"));
  lista.replaceChildren();
  for (const referencia of historia.referencias ?? []) {
    const rotulo = document.createElement("label");
    rotulo.className = "caixa";
    const caixa = document.createElement("input");
    caixa.type = "checkbox";
    caixa.name = "referencias";
    caixa.value = referencia.id;
    caixa.checked = marcadas.has(referencia.id);
    rotulo.append(caixa, ` ${referencia.nome} (${referencia.id})`);
    lista.append(rotulo);
  }
  $("campo-referencias").hidden = (historia.referencias ?? []).length === 0;
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

  limparGuarda();
  limparFechamento();
  mostrarConfirmacaoApagar(false);
  $("apagar-status").textContent = "";

  const resumo = $("sessao-resumo-pack");
  resumo.hidden = ultimoResumo === null || ultimoResumo.id !== id;
  resumo.textContent = ultimoResumo?.texto ?? "";
  // Sessão fechada não tem o que fechar; o fechamento continua podendo ser aplicado.
  $("fechar").hidden = sessao.status !== "aberta";
  mostrar("sessao");
  await carregarFechamento();
  // Depois de mostrar: o terminal só sabe o próprio tamanho quando está visível.
  await mostrarTerminais(id);
}

// --- Problemas do check e a correção com a IA ---

async function mostrarProblemas() {
  $("problemas-status").textContent = "";
  mostrar("problemas");
  await carregarProblemas();
  await mostrarTerminais(CORRECAO);
}

let pedidoCorrecao = null;

async function carregarProblemas() {
  let dados;
  try {
    dados = await api("/api/problemas");
  } catch (erro) {
    $("problemas-status").textContent = erro.message;
    return;
  }
  desenharProblemas(dados);
}

function desenharProblemas(dados) {
  pedidoCorrecao = dados.pedido;
  const tem = dados.erros + dados.avisos > 0;
  $("problemas-resumo").textContent = tem
    ? "Erro impede o pack de montar o pacote. Aviso não impede, mas costuma confundir a IA."
    : "Nenhum problema na pasta.";
  $("problemas-relatorio").textContent = dados.relatorio;
  $("resolver").disabled = !tem;
  $("copiar-pedido").disabled = !tem;

  confirmarDesfazer(false);
  $("problemas-mudancas").hidden = dados.mudancas.length === 0;
  if (dados.mudancas.length === 0) return;
  const quantos = dados.mudancas.length === 1 ? "1 arquivo mudou" : `${dados.mudancas.length} arquivos mudaram`;
  $("problemas-titulo").textContent = `${quantos} desde a última correção pedida (${new Date(dados.desde).toLocaleString("pt-BR")}). Confira antes de continuar.`;
  $("problemas-confirmar").textContent = `Confirmar: voltar ${dados.mudancas.length === 1 ? "o arquivo" : `os ${dados.mudancas.length} arquivos`} ao que era antes da correção`;
  const lista = $("problemas-lista");
  lista.replaceChildren();
  for (const mudanca of dados.mudancas) {
    const titulo = document.createElement("h4");
    titulo.textContent = `${mudanca.tipo}: ${mudanca.arquivo}`;
    lista.append(titulo, desenharDiff(mudanca.diff));
  }
}

function confirmarDesfazer(sim) {
  $("problemas-reverter").hidden = sim;
  $("problemas-confirmar").hidden = !sim;
  $("problemas-cancelar").hidden = !sim;
}

$("botao-problemas").addEventListener("click", () => (location.hash = "#problemas"));
$("resolver").addEventListener("click", () => abrirTerminal());
$("copiar-pedido").addEventListener("click", () =>
  copiar(pedidoCorrecao ?? "", "Pedido copiado. Cole na conversa com a IA, aberta na pasta da história.", "problemas-status"),
);
$("problemas-reler").addEventListener("click", async () => {
  await carregarHistoria();
  await carregarProblemas();
  $("problemas-status").textContent = "Check rodado de novo.";
});
$("problemas-reverter").addEventListener("click", () => confirmarDesfazer(true));
$("problemas-cancelar").addEventListener("click", () => confirmarDesfazer(false));
$("problemas-confirmar").addEventListener("click", async () => {
  try {
    const dados = await api("/api/problemas/reverter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    desenharProblemas(dados);
    await carregarHistoria();
    $("problemas-status").textContent = `Desfeito: ${dados.arquivos.map((a) => a.arquivo).join(", ")}.`;
  } catch (erro) {
    $("problemas-status").textContent = erro.message;
  }
});

// --- Instruções da IA: o "atualizar-instrucoes" da CLI ---

const ACAO_INSTRUCAO = {
  criado: "não existe ainda: será criado",
  igual: "já está atualizado",
  atualizado: "tem versão nova: será atualizado",
  editado: 'você editou ("-" é o seu texto, "+" é o texto novo do lore-pack)',
};

async function mostrarInstrucoes() {
  $("instrucoes-status").textContent = "";
  mostrar("instrucoes");
  try {
    desenharInstrucoes(await api("/api/instrucoes"));
  } catch (erro) {
    $("instrucoes-status").textContent = erro.message;
  }
}

function desenharInstrucoes(dados) {
  const lista = $("instrucoes-lista");
  lista.replaceChildren();
  for (const arquivo of dados.arquivos) {
    const titulo = document.createElement("h4");
    titulo.textContent = `${arquivo.arquivo}: ${ACAO_INSTRUCAO[arquivo.acao] ?? arquivo.acao}`;
    lista.append(titulo);
    if (arquivo.acao === "editado") lista.append(desenharDiff(arquivo.diff));
  }
  const editados = dados.arquivos.some((a) => a.acao === "editado");
  const pendentes = dados.arquivos.some((a) => a.acao !== "igual");
  // Com arquivo editado, o único jeito de gravar é o botão que diz o que vai acontecer.
  $("instrucoes-gravar").hidden = editados;
  $("instrucoes-gravar").disabled = !pendentes;
  $("instrucoes-sobrescrever").hidden = !editados;
}

async function gravarInstrucoes(sobrescrever) {
  const resposta = await pedir("/api/instrucoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sobrescrever }),
  });
  const dados = await resposta.json();
  if (dados.arquivos) desenharInstrucoes(dados);
  $("instrucoes-status").textContent = resposta.ok
    ? dados.gravados.length === 0
      ? "Já estava tudo atualizado."
      : `Gravado: ${dados.gravados.join(", ")}. Uma sessão aberta vai acusar essa mudança na guarda: é só clicar em "Manter".`
    : (dados.erro ?? `Erro ${resposta.status}`);
}

$("botao-instrucoes").addEventListener("click", () => (location.hash = "#instrucoes"));
$("instrucoes-gravar").addEventListener("click", () => gravarInstrucoes(false));
$("instrucoes-sobrescrever").addEventListener("click", () => gravarInstrucoes(true));
$("instrucoes-reler").addEventListener("click", mostrarInstrucoes);

// --- Conversa com a IA fora de sessão: discutir os rumos, ou conversa livre ---

async function mostrarConversa() {
  $("conversa-status").textContent = "";
  mostrar("conversa");
  await carregarConversa();
  await mostrarTerminais(CONVERSA);
}

async function carregarConversa() {
  try {
    desenharConversa(await api("/api/conversa"));
  } catch (erro) {
    $("conversa-status").textContent = erro.message;
  }
}

function desenharConversa(dados) {
  const fichas = dados.fichas === 1 ? "A ficha" : `As ${dados.fichas} fichas`;
  const referencias = dados.referencias === 1 ? "a referência" : `as ${dados.referencias} referências`;
  $("conversa-contexto").textContent =
    dados.fichas + dados.referencias === 0
      ? "A história ainda não tem fichas: a IA lê a bíblia e o estado."
      : `${fichas} e ${referencias} da história entram sozinhas, junto com a bíblia e o estado. Não precisa marcar nada.`;

  const lista = $("conversa-lista");
  lista.replaceChildren();
  confirmarDesfazerConversa(false);
  // Sem mudança não há o que desfazer; o "Verificar alterações" fica sempre à mão.
  $("conversa-reverter").hidden = dados.mudancas.length === 0;
  if (dados.desde === null) {
    $("conversa-titulo").textContent = "Nenhuma conversa foi aberta ainda. Ao abrir, o lore-pack guarda uma cópia dos arquivos para mostrar aqui o que mudar.";
    return;
  }
  const desde = new Date(dados.desde).toLocaleString("pt-BR");
  if (dados.mudancas.length === 0) {
    $("conversa-titulo").textContent = `Nenhum arquivo da história mudou desde que a conversa começou (${desde}).`;
    return;
  }
  const quantos = dados.mudancas.length === 1 ? "1 arquivo mudou" : `${dados.mudancas.length} arquivos mudaram`;
  $("conversa-titulo").textContent = `${quantos} desde que a conversa começou (${desde}). Se foi o que você pediu, não precisa fazer nada.`;
  $("conversa-confirmar").textContent = `Confirmar: voltar ${dados.mudancas.length === 1 ? "o arquivo" : `os ${dados.mudancas.length} arquivos`} ao que era antes da conversa`;
  for (const mudanca of dados.mudancas) {
    const titulo = document.createElement("h4");
    titulo.textContent = `${mudanca.tipo}: ${mudanca.arquivo}`;
    lista.append(titulo, desenharDiff(mudanca.diff));
  }
}

function confirmarDesfazerConversa(sim) {
  $("conversa-reverter").hidden = sim;
  $("conversa-reler").hidden = sim;
  $("conversa-confirmar").hidden = !sim;
  $("conversa-cancelar").hidden = !sim;
}

function assuntoDaConversa() {
  const assunto = $("conversa-assunto").value.trim();
  if (assunto === "") $("conversa-status").textContent = "Escreva antes o que você quer decidir.";
  return assunto;
}

$("botao-conversa").addEventListener("click", () => (location.hash = "#conversa"));
$("discutir").addEventListener("click", () => {
  $("conversa-status").textContent = "";
  const assunto = assuntoDaConversa();
  if (assunto !== "") abrirTerminal({ assunto });
});
$("copiar-discussao").addEventListener("click", async () => {
  $("conversa-status").textContent = "";
  const assunto = assuntoDaConversa();
  if (assunto === "") return;
  try {
    const pedido = await api("/api/conversa/pedido", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assunto }),
    });
    await copiar(pedido.texto, `Pedido copiado (~${pedido.tokens.toLocaleString("pt-BR")} tokens). Cole na conversa com a IA.`, "conversa-status");
  } catch (erro) {
    $("conversa-status").textContent = erro.message;
  }
});
$("conversa-reler").addEventListener("click", carregarConversa);
$("conversa-reverter").addEventListener("click", () => confirmarDesfazerConversa(true));
$("conversa-cancelar").addEventListener("click", () => confirmarDesfazerConversa(false));
$("conversa-confirmar").addEventListener("click", async () => {
  try {
    const dados = await api("/api/conversa/reverter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    desenharConversa(dados);
    await carregarHistoria();
    $("conversa-status").textContent = `Desfeito: ${dados.arquivos.map((a) => a.arquivo).join(", ")}.`;
  } catch (erro) {
    confirmarDesfazerConversa(false);
    $("conversa-status").textContent = erro.message;
  }
});

$("abrir-pasta").addEventListener("click", async () => {
  try {
    const { pasta } = await api("/api/pasta/abrir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    $("pasta-status").textContent = `Aberta: ${pasta}`;
  } catch (erro) {
    $("pasta-status").textContent = erro.message;
  }
});

// --- Guarda do cânone ---

function limparGuarda() {
  $("guarda-status").textContent = "";
  $("guarda-alerta").hidden = true;
  $("vigiar").hidden = true;
  mostrarConfirmacao(false);
}

function mostrarConfirmacao(sim) {
  $("reverter").hidden = sim;
  $("manter").hidden = sim;
  $("confirmar-reverter").hidden = !sim;
  $("cancelar-reverter").hidden = !sim;
}

async function verificarGuarda() {
  const id = rotaAtual().id;
  limparGuarda();
  let guarda;
  try {
    guarda = await api(`/api/sessoes/${encodeURIComponent(id)}/guarda`);
  } catch (erro) {
    $("guarda-status").textContent = erro.message;
    return;
  }

  if (!guarda.vigiada) {
    $("guarda-status").textContent =
      "Esta sessão não tem snapshot (foi criada antes da guarda do cânone). Clique em \"Começar a vigiar\" para comparar a partir de agora.";
    $("vigiar").hidden = false;
    return;
  }
  const desde = new Date(guarda.desde).toLocaleString("pt-BR");
  if (guarda.mudancas.length === 0) {
    $("guarda-status").textContent = `Nenhum arquivo protegido mudou desde ${desde}.`;
    return;
  }

  const quantos = guarda.mudancas.length === 1 ? "1 arquivo protegido mudou" : `${guarda.mudancas.length} arquivos protegidos mudaram`;
  $("guarda-titulo").textContent = `Atenção: ${quantos} desde ${desde}, fora do fechamento da sessão.`;
  $("confirmar-reverter").textContent = `Confirmar: voltar ${guarda.mudancas.length === 1 ? "o arquivo" : `os ${guarda.mudancas.length} arquivos`} ao snapshot`;

  const lista = $("guarda-lista");
  lista.replaceChildren();
  for (const mudanca of guarda.mudancas) {
    const titulo = document.createElement("h4");
    titulo.textContent = `${mudanca.tipo}: ${mudanca.arquivo}`;
    lista.append(titulo, desenharDiff(mudanca.diff));
  }
  $("guarda-alerta").hidden = false;
}

// Diff em texto ("+ " entrou, "- " saiu), com cor. Usado pela guarda e pelo fechamento.
function desenharDiff(texto) {
  const diff = document.createElement("pre");
  diff.className = "diff";
  for (const linha of texto.split("\n")) {
    const span = document.createElement("span");
    if (linha.startsWith("+ ")) span.className = "entrou";
    if (linha.startsWith("- ")) span.className = "saiu";
    span.textContent = `${linha}\n`;
    diff.append(span);
  }
  return diff;
}

async function acaoGuarda(acao, mensagem) {
  const id = rotaAtual().id;
  try {
    const resposta = await api(`/api/sessoes/${encodeURIComponent(id)}/guarda/${acao}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    await verificarGuarda();
    $("guarda-status").textContent = mensagem(resposta);
  } catch (erro) {
    $("guarda-status").textContent = erro.message;
  }
}

$("verificar").addEventListener("click", verificarGuarda);
$("vigiar").addEventListener("click", () =>
  acaoGuarda("vigiar", () => "Snapshot tirado. A partir de agora, mudanças nos arquivos protegidos serão acusadas."),
);
$("reverter").addEventListener("click", () => mostrarConfirmacao(true));
$("cancelar-reverter").addEventListener("click", () => mostrarConfirmacao(false));
$("confirmar-reverter").addEventListener("click", () =>
  acaoGuarda("reverter", (r) => `Revertido: ${r.arquivos.map((a) => a.arquivo).join(", ")}.`),
);
$("manter").addEventListener("click", () =>
  acaoGuarda("manter", (r) => `Mantido e registrado em alteracoes-diretas.md: ${r.arquivos.map((a) => a.arquivo).join(", ")}.`),
);

// --- Fechamento: escolher quais mudanças propostas pela IA aplicar ---
// A página só manda o id da sessão e os números da lista. O que cada operação faz é lido,
// no servidor, do fechamento.md.

function limparFechamento() {
  $("fechamento-texto").value = "";
  $("fechamento-status").textContent = "";
  $("fechamento-check").hidden = true;
  $("fechar-erro").hidden = true;
  $("fechar-resumo").value = "";
  mostrarConfirmacaoFechar(false);
  desenharFechamento({ existe: false, operacoes: [], erro: null, pedidoCorrecao: null, aviso: null });
  $("fechamento-colar").hidden = true;
}

function mostrarConfirmacaoAplicar(sim) {
  $("fechamento-aplicar").hidden = sim;
  $("confirmar-aplicar").hidden = !sim;
  $("cancelar-aplicar").hidden = !sim;
}

function mostrarConfirmacaoFechar(sim) {
  $("fechar-resumo-campo").hidden = !sim;
  $("fechar-sessao").hidden = sim;
  $("confirmar-fechar").hidden = !sim;
  $("cancelar-fechar").hidden = !sim;
}

function mostrarErroFechamento(erro, pedidoCorrecao) {
  $("fechamento-erro").textContent = erro ?? "";
  $("fechamento-erro").hidden = !erro;
  // Bloco inválido: o servidor manda o texto pronto para pedir a correção à IA.
  $("fechamento-pedido").textContent = pedidoCorrecao ?? "";
  $("fechamento-correcao").hidden = !pedidoCorrecao;
}

function marcadasFechamento() {
  return [...$("fechamento-lista").querySelectorAll("input:checked")].map((caixa) => Number(caixa.value));
}

function desenharFechamento(dados) {
  $("fechamento-colar").hidden = dados.existe;
  $("fechamento-existe").hidden = !dados.existe;
  $("fechamento-arquivo").textContent = `sessoes/${rotaAtual().id}/fechamento.md`;
  $("fechamento-aviso").textContent = dados.aviso ?? "";
  $("fechamento-aviso").hidden = !dados.aviso;
  mostrarErroFechamento(dados.erro, dados.pedidoCorrecao);
  mostrarConfirmacaoAplicar(false);

  const lista = $("fechamento-lista");
  lista.replaceChildren();
  let disponiveis = 0;
  for (const operacao of dados.operacoes) {
    const bloco = document.createElement("div");
    bloco.className = "operacao";
    const titulo = `[${operacao.indice}] ${operacao.titulo}`;
    // Só ganha caixa de seleção o que ainda pode ser aplicado.
    const disponivel = !operacao.aplicada && operacao.tipo !== "informativo" && operacao.erro === null;

    if (disponivel) {
      disponiveis++;
      const rotulo = document.createElement("label");
      rotulo.className = "caixa";
      const caixa = document.createElement("input");
      caixa.type = "checkbox";
      caixa.value = String(operacao.indice);
      caixa.checked = true;
      rotulo.append(caixa, ` ${titulo}`);
      const arquivo = document.createElement("p");
      arquivo.className = "dica";
      arquivo.textContent = `${operacao.tipo === "criado" ? "arquivo novo" : "arquivo"}: ${operacao.arquivo}`;
      bloco.append(rotulo, arquivo, desenharDiff(operacao.diff));
    } else {
      const cabecalho = document.createElement("p");
      cabecalho.className = "titulo";
      cabecalho.textContent = operacao.aplicada ? `${titulo} (já aplicada)` : titulo;
      bloco.append(cabecalho);
      if (operacao.erro !== null) {
        const motivo = document.createElement("p");
        motivo.className = "aviso";
        motivo.textContent = `Não dá para aplicar: ${operacao.erro}`;
        bloco.append(motivo);
      } else if (operacao.tipo === "informativo") {
        const itens = document.createElement("pre");
        itens.textContent = operacao.diff;
        bloco.append(itens);
      }
    }
    lista.append(bloco);
  }
  $("fechamento-acoes").hidden = disponiveis === 0;
  if (dados.existe && !dados.erro && disponiveis === 0) {
    $("fechamento-status").textContent =
      dados.operacoes.length === 0 ? "O fechamento não traz nenhuma operação." : "Não há mais nada para aplicar deste fechamento.";
  }
}

async function carregarFechamento() {
  const id = rotaAtual().id;
  try {
    const dados = await api(`/api/sessoes/${encodeURIComponent(id)}/fechamento`);
    // A resposta pode chegar depois de o autor trocar de sessão.
    if (rotaAtual().id === id) desenharFechamento(dados);
  } catch (erro) {
    mostrarErroFechamento(erro.message, null);
  }
}

// Manda um POST da sessão atual e devolve { ok, dados }, sem lançar erro: a tela mostra o que vier.
async function postarSessao(caminho, corpo) {
  const resposta = await pedir(`/api/sessoes/${encodeURIComponent(rotaAtual().id)}/${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  return { ok: resposta.ok, dados: await resposta.json() };
}

// Salva o texto colado como fechamento.md da sessão e mostra a lista.
$("fechamento-ler").addEventListener("click", async () => {
  $("fechamento-status").textContent = "";
  const { ok, dados } = await postarSessao("fechamento", { texto: $("fechamento-texto").value });
  if (!ok) return mostrarErroFechamento(dados.erro, dados.pedidoCorrecao);
  desenharFechamento(dados);
});

$("fechamento-reler").addEventListener("click", () => {
  $("fechamento-status").textContent = "";
  $("fechamento-check").hidden = true;
  return carregarFechamento();
});

// Aplicar pede um segundo clique, como o Reverter da guarda.
$("fechamento-aplicar").addEventListener("click", () => {
  const quantas = marcadasFechamento().length;
  if (quantas === 0) {
    $("fechamento-status").textContent = "Marque pelo menos uma mudança para aplicar.";
    return;
  }
  $("fechamento-status").textContent = "";
  $("confirmar-aplicar").textContent = `Confirmar: aplicar ${quantas === 1 ? "1 mudança" : `${quantas} mudanças`}`;
  mostrarConfirmacaoAplicar(true);
});
$("cancelar-aplicar").addEventListener("click", () => mostrarConfirmacaoAplicar(false));
// Mudou a seleção depois de pedir a confirmação: o número do botão não vale mais.
$("fechamento-lista").addEventListener("change", () => mostrarConfirmacaoAplicar(false));

$("confirmar-aplicar").addEventListener("click", async () => {
  const botao = $("confirmar-aplicar");
  botao.disabled = true;
  try {
    const { ok, dados } = await postarSessao("fechamento/aplicar", { indices: marcadasFechamento() });
    mostrarConfirmacaoAplicar(false);
    if (!ok) return mostrarErroFechamento(dados.erro, null);
    desenharFechamento(dados);
    const quantas = dados.aplicadas.length === 1 ? "1 mudança aplicada" : `${dados.aplicadas.length} mudanças aplicadas`;
    $("fechamento-status").textContent = `${quantas} em: ${dados.arquivos.join(", ")}.`;
    $("fechamento-check").textContent = `Check depois de aplicar:\n${dados.check}`;
    $("fechamento-check").hidden = false;
    // O número de erros da barra lateral pode ter mudado.
    await carregarHistoria();
  } finally {
    botao.disabled = false;
  }
});

$("fechar-sessao").addEventListener("click", () => mostrarConfirmacaoFechar(true));
$("cancelar-fechar").addEventListener("click", () => mostrarConfirmacaoFechar(false));
$("confirmar-fechar").addEventListener("click", async () => {
  const id = rotaAtual().id;
  const { ok, dados } = await postarSessao("fechar", { resumo: $("fechar-resumo").value });
  mostrarConfirmacaoFechar(false);
  if (!ok) {
    // Por exemplo, a recusa da guarda: alteração direta ainda não resolvida.
    $("fechar-erro").textContent = dados.erro ?? "Não consegui fechar a sessão.";
    $("fechar-erro").hidden = false;
    return;
  }
  await carregarHistoria();
  await mostrarSessao(id);
});

$("copiar-correcao").addEventListener("click", () =>
  copiar($("fechamento-pedido").textContent, "Pedido de correção copiado. Cole na conversa com a IA.", "fechamento-status"),
);

// --- Apagar sessão (segundo clique confirma) ---

function mostrarConfirmacaoApagar(sim) {
  $("apagar").hidden = sim;
  $("confirmar-apagar").hidden = !sim;
  $("cancelar-apagar").hidden = !sim;
}

$("apagar").addEventListener("click", () => mostrarConfirmacaoApagar(true));
$("cancelar-apagar").addEventListener("click", () => mostrarConfirmacaoApagar(false));
$("confirmar-apagar").addEventListener("click", async () => {
  const id = rotaAtual().id;
  try {
    await api(`/api/sessoes/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (erro) {
    mostrarConfirmacaoApagar(false);
    $("apagar-status").textContent = erro.message;
    return;
  }
  await carregarHistoria();
  location.hash = "";
  $("inicio").querySelector("p").textContent = `Sessão ${id} apagada.`;
});

// onde: o id do elemento que mostra o resultado (por padrão, ao lado do "Copiar pacote").
async function copiar(texto, mensagem, onde = "copiado") {
  try {
    await navigator.clipboard.writeText(texto);
    $(onde).textContent = mensagem;
  } catch {
    $(onde).textContent = "Não consegui copiar. Selecione o texto e copie à mão.";
  }
}

$("botao-nova").addEventListener("click", () => (location.hash = "#nova"));

// --- Novo capítulo: um campo só, na própria barra ---

function mostrarFormCapitulo(sim) {
  $("form-capitulo").hidden = !sim;
  $("botao-capitulo").hidden = sim;
  if (sim) $("form-capitulo").elements.titulo.focus();
}

$("botao-capitulo").addEventListener("click", () => {
  $("capitulo-status").textContent = "";
  mostrarFormCapitulo(true);
});
$("cancelar-capitulo").addEventListener("click", () => mostrarFormCapitulo(false));
$("form-capitulo").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  try {
    const criado = await api("/api/capitulos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: form.elements.titulo.value }),
    });
    form.reset();
    mostrarFormCapitulo(false);
    $("capitulo-status").textContent = `Criado: capitulos/${criado.id}.md`;
    await carregarHistoria();
    // Na tela de nova sessão, o capítulo novo já entra na lista, escolhido.
    if (rotaAtual().tipo === "nova") {
      mostrarNova();
      document.querySelector('#form-nova [name="capitulo"]').value = criado.id;
    }
  } catch (erro) {
    $("capitulo-status").textContent = erro.message;
  }
});

$("copiar-comando").addEventListener("click", () => copiar($("sessao-comando").textContent, "Comando copiado."));

$("copiar-pacote").addEventListener("click", async () => {
  const id = rotaAtual().id;
  const resposta = await pedir(`/api/sessoes/${encodeURIComponent(id)}/pacote`);
  if (!resposta.ok) {
    $("copiado").textContent = "Não achei o pacote.md desta sessão.";
    return;
  }
  await copiar(await resposta.text(), "Pacote copiado. Cole na conversa com a IA.");
});

// O que o formulário de nova sessão manda, para criar a sessão ou só montar o pacote.
function dadosDaNova() {
  const dados = new FormData($("form-nova"));
  return {
    capitulo: dados.get("capitulo"),
    plano: dados.get("plano"),
    com: dados.get("com"),
    referencias: dados.getAll("referencias"),
    sem: dados.get("sem"),
    alfabeto: dados.get("alfabeto") === "on",
    semUltimaCena: dados.get("semUltimaCena") === "on",
    limite: dados.get("limite"),
  };
}

// O "pack" da CLI: mostra o resumo e deixa copiar, sem criar sessão.
let pacoteAvulso = "";

$("so-pacote").addEventListener("click", async () => {
  const botao = $("so-pacote");
  botao.disabled = true;
  $("erro-nova").hidden = true;
  $("pacote-avulso").hidden = true;
  try {
    const pacote = await api("/api/pacote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosDaNova()),
    });
    pacoteAvulso = pacote.texto;
    // A primeira linha do resumo é o caminho do arquivo, que aqui não interessa ao autor.
    $("pacote-avulso-resumo").textContent = pacote.resumo.split("\n").slice(2).join("\n");
    $("pacote-avulso-status").textContent = "";
    $("pacote-avulso").hidden = false;
  } catch (erro) {
    $("erro-nova").textContent = erro.message;
    $("erro-nova").hidden = false;
  } finally {
    botao.disabled = false;
  }
});
$("copiar-pacote-avulso").addEventListener("click", () =>
  copiar(pacoteAvulso, "Pacote copiado. Cole na conversa com a IA.", "pacote-avulso-status"),
);

$("form-nova").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  const botao = form.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    const criada = await api("/api/sessoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosDaNova()),
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

// --- Terminal embutido ---
// Um objeto por terminal aberto (de qualquer sessão). Trocar de sessão só esconde a tela;
// o programa continua rodando no servidor. Recarregar a página reanexa pela lista do servidor.
const terminais = new Map();
let terminalAtivo = null;
let modulosXterm = null;

// O xterm só é baixado quando a sessão é aberta: quem não usa o terminal não paga por ele.
function carregarXterm() {
  modulosXterm ??= Promise.all([import("/vendor/xterm.mjs"), import("/vendor/addon-fit.mjs")]).then(
    ([xterm, fit]) => ({ Terminal: xterm.Terminal, FitAddon: fit.FitAddon }),
  );
  return modulosXterm;
}

function avisoTerminal(texto) {
  $("terminal-aviso").textContent = texto ?? "";
  $("terminal-aviso").hidden = !texto;
}

async function mostrarTerminais(sessaoId) {
  avisoTerminal(null);
  let estado;
  try {
    estado = await api("/api/terminal");
  } catch (erro) {
    estado = { ligado: false, motivo: erro.message };
  }
  // Desligado (config "nenhum", comando não instalado, node-pty ausente): o motivo fica na tela.
  $("abrir-terminal").disabled = !estado.ligado;
  if (!estado.ligado) avisoTerminal(estado.motivo);

  try {
    for (const t of await api("/api/terminais")) {
      if (!terminais.has(t.id)) await criarTerminal(t.id, t.sessao);
    }
  } catch (erro) {
    avisoTerminal(`Não consegui mostrar os terminais: ${erro.message}`);
  }
  desenharAbas(sessaoId);
}

async function criarTerminal(id, sessao) {
  const { Terminal, FitAddon } = await carregarXterm();
  const el = document.createElement("div");
  el.className = "terminal";
  el.hidden = true;
  $("terminais").append(el);

  const term = new Terminal({
    cursorBlink: true,
    fontFamily: "ui-monospace, Consolas, 'Cascadia Mono', monospace",
    fontSize: 14,
    theme: { background: "#1c1b18" },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(el);

  const t = { id, sessao, term, fit, el, ws: null, rodando: true, codigo: null, desconectado: false };
  terminais.set(id, t);
  term.onData((dados) => enviar(t, { tipo: "entrada", dados }));
  term.onResize(({ cols, rows }) => enviar(t, { tipo: "tamanho", colunas: cols, linhas: rows }));
  term.attachCustomKeyEventHandler((evento) => teclaEspecial(t, evento));
  conectar(t);
  return t;
}

function conectar(t) {
  const protocolo = location.protocol === "https:" ? "wss" : "ws";
  // O navegador não deixa pôr cabeçalho em WebSocket: o token vai na URL.
  const ws = new WebSocket(`${protocolo}://${location.host}/ws/terminais/${t.id}?token=${encodeURIComponent(TOKEN)}`);
  t.ws = ws;
  ws.addEventListener("open", () => ajustar(t));
  ws.addEventListener("message", (evento) => {
    const mensagem = JSON.parse(evento.data);
    if (mensagem.tipo === "saida") t.term.write(mensagem.dados);
    if (mensagem.tipo === "fim") {
      t.rodando = false;
      t.codigo = mensagem.codigo;
      t.term.write(`\r\n\x1b[2m[programa encerrado, código ${mensagem.codigo}]\x1b[0m\r\n`);
      desenharAbas(rotaAtual().id);
      // A correção terminou: roda o check de novo e mostra o que ela mudou.
      if (t.sessao === CORRECAO) carregarHistoria().then(() => rotaAtual().tipo === "problemas" && carregarProblemas());
      // A conversa terminou: mostra o que ela mudou (o check da barra também pode ter mudado).
      else if (t.sessao === CONVERSA) carregarHistoria().then(() => rotaAtual().tipo === "conversa" && carregarConversa());
      // A IA pode ter acabado de escrever o fechamento.md.
      else if (rotaAtual().id === t.sessao) carregarFechamento();
    }
    // A guarda comparou quando o programa terminou: se algo mudou, mostra o aviso da sessão.
    if (mensagem.tipo === "guarda" && mensagem.mudancas.length > 0 && t.sessao !== CORRECAO && t.sessao !== CONVERSA && rotaAtual().id === t.sessao) verificarGuarda();
  });
  ws.addEventListener("close", () => {
    if (t.rodando && terminais.has(t.id)) {
      t.desconectado = true;
      desenharAbas(rotaAtual().id);
    }
  });
}

function enviar(t, mensagem) {
  if (t.ws?.readyState === WebSocket.OPEN) t.ws.send(JSON.stringify(mensagem));
}

// Ajusta o terminal ao espaço da tela e avisa o programa do novo tamanho.
function ajustar(t) {
  if (t.el.hidden) return;
  t.fit.fit();
  enviar(t, { tipo: "tamanho", colunas: t.term.cols, linhas: t.term.rows });
}

window.addEventListener("resize", () => {
  const ativo = terminais.get(terminalAtivo);
  if (ativo) ajustar(ativo);
});

// Ctrl+C com texto selecionado copia; sem seleção, vai para o programa (interromper).
// Ctrl+V fica com o navegador, que cola, e o xterm manda o texto colado para o programa.
function teclaEspecial(t, evento) {
  if (evento.type !== "keydown" || !(evento.ctrlKey || evento.metaKey)) return true;
  const tecla = evento.key.toLowerCase();
  if (tecla === "c" && t.term.hasSelection()) {
    navigator.clipboard.writeText(t.term.getSelection()).catch(() => {});
    t.term.clearSelection();
    return false;
  }
  if (tecla === "v") return false;
  return true;
}

function desenharAbas(sessaoId) {
  const daSessao = [...terminais.values()].filter((t) => t.sessao === sessaoId);
  if (!daSessao.some((t) => t.id === terminalAtivo)) terminalAtivo = daSessao.at(-1)?.id ?? null;
  for (const t of terminais.values()) t.el.hidden = t.id !== terminalAtivo;

  const abas = $("abas-terminal");
  abas.replaceChildren();
  daSessao.forEach((t, indice) => {
    const aba = document.createElement("div");
    aba.className = t.rodando ? "aba" : "aba encerrado";
    aba.setAttribute("role", "tab");
    aba.setAttribute("aria-selected", String(t.id === terminalAtivo));

    const nome = document.createElement("button");
    nome.type = "button";
    const estado = document.createElement("span");
    estado.className = "estado";
    estado.textContent = !t.rodando
      ? ` · encerrado (código ${t.codigo})`
      : t.desconectado
        ? " · desconectado"
        : " · rodando";
    nome.append(`Terminal ${indice + 1}`, estado);
    nome.addEventListener("click", () => {
      terminalAtivo = t.id;
      desenharAbas(sessaoId);
      t.term.focus();
    });

    const fechar = document.createElement("button");
    fechar.type = "button";
    fechar.className = "fechar";
    fechar.textContent = "×";
    fechar.title = t.rodando ? "Fechar: encerra o programa" : "Fechar";
    fechar.addEventListener("click", () => {
      // Com o programa rodando, fechar encerra a conversa com a IA: pede um segundo clique.
      if (t.rodando && fechar.textContent === "×") {
        fechar.textContent = "encerrar?";
        setTimeout(() => (fechar.textContent = "×"), 3000);
        return;
      }
      fecharTerminal(t);
    });

    aba.append(nome, fechar);
    abas.append(aba);
  });

  const ativo = terminais.get(terminalAtivo);
  if (ativo) requestAnimationFrame(() => ajustar(ativo));
}

async function fecharTerminal(t) {
  try {
    await api(`/api/terminais/${t.id}`, { method: "DELETE" });
  } catch {
    // O servidor já não tinha esse terminal: só tira da tela.
  }
  t.ws?.close();
  t.term.dispose();
  t.el.remove();
  terminais.delete(t.id);
  if (terminalAtivo === t.id) terminalAtivo = null;
  desenharAbas(rotaAtual().id);
}

// Na tela de problemas, o terminal novo é uma correção: o servidor monta o pedido e abre a IA com ele.
// Na de conversa, o corpo pode levar o assunto da discussão; vazio, a IA abre sem pedido.
const CAMINHO_TERMINAL = { problemas: "/api/problemas/terminais", conversa: "/api/conversa/terminais" };

async function abrirTerminal(corpo = {}) {
  const rota = rotaAtual();
  const sessaoId = rota.id;
  const caminho = CAMINHO_TERMINAL[rota.tipo] ?? `/api/sessoes/${encodeURIComponent(sessaoId)}/terminais`;
  const botao = $("abrir-terminal");
  botao.disabled = true;
  avisoTerminal(null);
  try {
    // Qual programa roda é decidido pelo lore-pack.config.json, no servidor, nunca por este pedido.
    const { id } = await api(caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const t = await criarTerminal(id, sessaoId);
    terminalAtivo = id;
    desenharAbas(sessaoId);
    t.term.focus();
  } catch (erro) {
    avisoTerminal(erro.message);
  } finally {
    botao.disabled = false;
  }
}

$("abrir-terminal").addEventListener("click", () => abrirTerminal());

window.addEventListener("hashchange", navegar);

try {
  await carregarHistoria();
  await navegar();
} catch (erro) {
  $("inicio").querySelector("p").textContent = `Não consegui ler a história: ${erro.message}`;
}
