/* GuGa · O que fazer: enchente, vento forte e granizo. Frases curtas, leitura em voz alta, envio pelo WhatsApp. */
GG.guia = (() => {
  const FASES = [
    { id: "prepare", ic: "mochila", rot: "Antes da chuva", cab: "🟢 PREPARE-SE",
      passos: [
        ["Cadastre o seu CEP", "Mande o CEP por SMS para 40199. A Defesa Civil avisa de graça.", "telefone"],
        ["Veja se a sua casa alaga", "Na tela Minha casa. Anote a altura do Guaíba que alaga a sua rua.", "casaAgua"],
        ["Arrume uma mochila", "Documentos em saco plástico, remédios e receitas, óculos, carregador, lanterna e água.", "mochila"],
        ["Combine com a família", "Onde se encontrar e quem busca cada idoso.", "familia"],
      ] },
    { id: "atencao", ic: "ondas", rot: "Rio subindo", cab: "🟡 ATENÇÃO",
      passos: [
        ["Carregue o celular", "Deixe a mochila perto da porta.", "bateria"],
        ["Suba móveis e aparelhos", "Em cima de mesas ou no andar de cima.", "subir"],
        ["Tire o carro da rua baixa", "Agora, antes das ruas fecharem.", "carro"],
        ["Idosos e acamados saem primeiro", "Não espere o último aviso. Precisa de ajuda para tirar alguém? Ligue 199.", "idoso"],
        ["Prepare os animais", "Coleira com telefone, caixa de transporte e ração.", "animal"],
      ] },
    { id: "saia", ic: "alerta", rot: "Saia agora", crit: true, cab: "🔴 SAIA AGORA",
      passos: [
        ["Desligue a luz e o gás", "Desligue a chave geral antes de sair.", "luz"],
        ["Pegue a mochila e os animais", "Tranque a casa.", "mochila"],
        ["Vá para um lugar alto", "Casa de parente em lugar alto ou abrigo da Defesa Civil.", "morro"],
        ["Nunca entre em água correndo", "Água no joelho com correnteza derruba um adulto.", "correnteza"],
      ] },
    { id: "ilhado", ic: "boia", rot: "Estou ilhado", crit: true, cab: "🆘 ILHADO",
      passos: [
        ["Suba para o lugar mais alto", "Andar de cima, laje ou telhado. Leve água, remédio e celular.", "subir"],
        ["Ligue 193", "Diga o endereço, quantas pessoas e se tem criança, idoso ou acamado.", "telefone"],
        ["Peça socorro no GuGa", "Botão Pedir socorro. Sem internet, o pedido sai sozinho quando voltar o sinal.", "boia"],
        ["Faça sinal", "Pano claro na janela de dia. Lanterna à noite.", "lanterna"],
      ] },
    { id: "vento", ic: "vento", rot: "Vento forte", cab: "🌬️ VENTO FORTE",
      passos: [
        ["Fique em casa, longe das janelas", "Feche portas e janelas. Fique no cômodo sem vidro.", "janela"],
        ["Guarde o que pode voar", "Vasos, roupas no varal, móveis do pátio, telhas soltas.", "vento"],
        ["Longe de árvores, postes e placas", "Não fique nem estacione embaixo deles.", "proibido"],
        ["Fio caído: não chegue perto", "Pode estar ligado. Avise o 199.", "luz"],
        ["Tire os aparelhos da tomada", "Quedas de luz e raios queimam aparelhos.", "chave"],
      ] },
    { id: "granizo", ic: "granizo", rot: "Granizo", cab: "🧊 GRANIZO",
      passos: [
        ["Entre em casa ou num prédio", "Na rua, proteja a cabeça com bolsa ou casaco.", "casa"],
        ["Longe de janelas e telhas de vidro", "O gelo quebra vidro e telha.", "janela"],
        ["No carro: pare em lugar coberto", "Se não houver, pare no acostamento e fique dentro, longe dos vidros.", "carro"],
        ["Proteja os animais", "Leve para um lugar coberto.", "animal"],
        ["Depois, olhe o telhado de longe", "Telha quebrada? Peça lona à Defesa Civil: 199. Não suba no telhado molhado.", "alerta"],
      ] },
    { id: "depois", ic: "sol", rot: "Depois", cab: "🔵 DEPOIS",
      passos: [
        ["Volte só quando liberarem", "Espere a Defesa Civil.", "escudo"],
        ["Não ligue a luz com a casa molhada", "Chame um eletricista.", "luz"],
        ["Use botas e luvas na limpeza", "Febre ou dor nas pernas depois? Vá ao posto de saúde.", "bota"],
        ["Fotografe antes de limpar", "As fotos ajudam no seguro e nos auxílios.", "camera"],
        ["Jogue fora o que molhou", "Comida e remédio que tocaram a água da enchente.", "lixo"],
      ] },
  ];
  let fase = "prepare";

  function mensagem(id) {
    const F = FASES.find((f) => f.id === id);
    const casa = GG.casa.salva(), e = GG.estadoGuaiba(GG.live.nivel), ab = GG.casa.abrigosSugeridos?.[0];
    const linhas = [`${F.cab} · GuGa`];
    if (["atencao", "saia", "ilhado"].includes(id)) {
      if (e) linhas.push(`Guaíba em ${GG.m(e.cm)}, ${e.mov}${e.simulado ? " (simulação de treino)" : ""}.`);
      if (casa?.faixa) linhas.push(`A rua de casa${casa.bairro ? ` (${casa.bairro})` : ""} alaga a partir de ${GG.m(casa.faixa.prev)}.`);
    }
    linhas.push("", ...F.passos.map((p, i) => `${i + 1}. ${p[0]}`));
    if (id === "saia" && ab) linhas.push("", `Lugar alto mais perto: ${ab.nome}. Confirme no 199 se está aberto.`);
    linhas.push("", "📞 Bombeiros 193 · Defesa Civil 199 · SAMU 192", `👉 ${GG.CONFIG.urlPublica || location.href.split("#")[0]}`);
    return linhas.join("\n");
  }

  function render() {
    const F = FASES.find((f) => f.id === fase);
    GG.$("#guia-fases").innerHTML = FASES.map((f) => `<button role="tab" class="${f.crit ? "f-crit" : ""}" aria-selected="${f.id === fase}" data-f="${f.id}">${GG.ic(f.ic, 34)}${f.rot}</button>`).join("");
    GG.$$("#guia-fases button").forEach((b) => b.onclick = () => { parar(); fase = b.dataset.f; render(); });
    GG.$("#guia-titulo").textContent = F.rot;
    GG.$("#guia-passos").innerHTML = `<ol class="passos ${F.crit ? "crit" : ""}">${F.passos.map((p) => `<li><span class="pi">${GG.ic(p[2] || "check", 34)}</span><span><b>${p[0]}</b>${p[1]}</span></li>`).join("")}</ol>`;
    const msg = mensagem(fase);
    GG.$("#guia-zap").innerHTML = `<div class="linha" style="margin-top:6px"><a class="btn zap" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${GG.ic("whatsapp", 26)}Mandar estes passos</a><button class="btn" id="zap-copiar">Copiar</button></div>`;
    GG.$("#zap-copiar").onclick = () => GG.relatar.copiar(msg);
  }

  // leitura em voz alta pelo botão Ouvir do topo: um passo por vez, com o passo lido em destaque
  function parar() {
    if (GG.voz.falando) GG.voz.parar();
    GG.$$("#guia-passos li").forEach((li) => li.classList.remove("lendo"));
  }
  function falar() {
    const F = FASES.find((f) => f.id === fase);
    const lis = () => GG.$$("#guia-passos li");
    return {
      partes: [`${F.rot}.`, ...F.passos.map((p, i) => `${i + 1}. ${p[0]}. ${p[1]}`)],
      onParte: (k) => { lis().forEach((li, j) => li.classList.toggle("lendo", j === k - 1)); if (k > 0) lis()[k - 1]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); },
      fim: () => lis().forEach((li) => li.classList.remove("lendo")),
    };
  }

  function plano() {
    const p = GG.store.get("plano", {});
    const campos = [["encontro", "Onde a família se encontra"], ["contato", "Contato fora da cidade"], ["padrinho", "Quem ajuda o idoso a sair"], ["remedios", "Remédios de uso diário"], ["animais", "Animais"]];
    GG.$("#guia-plano").innerHTML = campos.map(([k, r]) => `<label class="campo">${r}<input type="text" id="pl-${k}" value="${GG.esc(p[k] || "")}"></label>`).join("") +
      `<div class="linha"><button class="btn primario" id="pl-salvar">Salvar</button><button class="btn zap" id="pl-zap">${GG.ic("whatsapp", 24)}Mandar para a família</button></div>`;
    const ler = () => Object.fromEntries(campos.map(([k]) => [k, GG.$("#pl-" + k).value.trim()]));
    GG.$("#pl-salvar").onclick = () => { GG.store.set("plano", ler()); GG.toast("Plano salvo neste celular."); };
    GG.$("#pl-zap").onclick = () => {
      const d = ler(); GG.store.set("plano", d);
      open("https://wa.me/?text=" + encodeURIComponent(`📋 Nosso plano de emergência (GuGa)\n\n${campos.filter(([k]) => d[k]).map(([k, r]) => `• ${r}: ${d[k]}`).join("\n")}\n\nBombeiros 193 · Defesa Civil 199`), "_blank", "noopener");
    };
  }

  function iniciar() {
    GG.$("#guia-tels").innerHTML = GG.CONFIG.telefones.slice(0, 3).map((t) => `<a class="tel" href="tel:${t.n}"><span class="n">${t.n}</span><span class="nome">${t.nome}</span><span class="q">${t.quando}</span></a>`).join("");
    GG.$("#guia-alertas").innerHTML = GG.CONFIG.alertasOficiais.map((a) => `<p><b>${a.canal}:</b> <span style="user-select:all">${a.como}</span>. <span class="mut">${a.detalhe}</span></p>`).join("");
    GG.voz.resumo("guia", falar);
    GG.on("nivel", () => !GG.$("#v-guia").hidden && render());
    GG.on("casa", render);
    render(); plano();
  }
  return { iniciar, mensagem, FASES, parar, fase: (id) => { if (FASES.some((f) => f.id === id)) { parar(); fase = id; render(); } } };
})();
