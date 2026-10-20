/* GuGa · leitura em voz alta em todas as telas. O botão "Ouvir" do topo lê o resumo da tela aberta,
   em frases curtas e devagar; tocar de novo para. Cada tela registra o seu resumo com GG.voz.resumo(vista, () => texto). */
GG.voz = (() => {
  const resumos = {};
  let falando = false, aoParar = null;
  const tem = () => "speechSynthesis" in window;

  function vozPt() {
    const vs = speechSynthesis.getVoices();
    return vs.find((v) => v.lang === "pt-BR" && /google|luciana|francisca|thalita|maria/i.test(v.name)) || vs.find((v) => v.lang?.replace("_", "-").startsWith("pt-BR")) || vs.find((v) => v.lang?.startsWith("pt"));
  }

  // números ditos do jeito que a gente fala: "2,85 m" → "2 metros e 85"
  function falavel(t) {
    return String(t)
      .replace(/(\d+),(\d{2}) m\b/g, (_, a, b) => `${a} metro${a === "1" ? "" : "s"} e ${+b}`)
      .replace(/(\d+) cm\b/g, "$1 centímetros").replace(/(\d+) mm\b/g, "$1 milímetros")
      .replace(/(\d+) km\/h/g, "$1 quilômetros por hora").replace(/(\d+) km\b/g, "$1 quilômetros")
      .replace(/\b(\d+) h\b/g, "$1 horas").replace(/\bnº\s?/g, "número ").replace(/·/g, ".");
  }

  function botao() {
    const b = GG.$("#btn-ouvir"); if (!b) return;
    b.innerHTML = `${GG.ic(falando ? "parar" : "falar", 26)}<span>${falando ? "Parar" : "Ouvir"}</span>`;
    b.classList.toggle("falando", falando);
    b.setAttribute("aria-pressed", String(falando));
    b.setAttribute("aria-label", falando ? "Parar a leitura" : "Ouvir esta tela em voz alta");
  }

  function parar() {
    const tinha = falando;
    falando = false;
    if (tem()) speechSynthesis.cancel();
    if (tinha && aoParar) { const f = aoParar; aoParar = null; f(); }
    botao();
  }

  /** partes: texto ou lista de textos (cada um vira uma fala, com pausa entre elas). onParte(i) avisa qual está sendo lida. */
  function ler(partes, { onParte, fim } = {}) {
    if (!tem()) { GG.toast("Este celular não lê em voz alta.", "erro"); return; }
    parar();
    const lista = (Array.isArray(partes) ? partes : [partes]).filter(Boolean);
    if (!lista.length) return;
    const voz = vozPt();
    falando = true; aoParar = fim || null; botao();
    lista.forEach((txt, i) => {
      const u = new SpeechSynthesisUtterance(falavel(txt));
      u.lang = "pt-BR"; u.rate = 0.88; if (voz) u.voice = voz;
      u.onstart = () => onParte?.(i);
      if (i === lista.length - 1) u.onend = () => falando && parar();
      u.onerror = () => falando && parar();
      speechSynthesis.speak(u);
    });
  }

  // telas sem resumo próprio: lê o título e os textos principais que estão à vista
  function textoDe(el, sel = "h2, h3, .titulo p, .resumo, .legenda-morro, .vergonha-topo p, .numeros div") {
    return [...el.querySelectorAll(sel)].filter((x) => x.offsetParent !== null).map((x) => x.textContent.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 10);
  }
  function lerFolha(f) {
    if (falando) return parar();
    ler(textoDe(f, "h2, h3, p:not(.assinatura), .opcao, .canal b, label.campo, .btn.grande").slice(0, 14));
  }

  function lerTela() {
    if (falando) return parar();
    const v = GG.vistaAtual?.() || "inicio";
    const r = resumos[v];
    if (!r) return ler(textoDe(GG.$("#v-" + v) || document.body));
    const out = r();
    if (out && typeof out === "object" && !Array.isArray(out) && out.partes) ler(out.partes, out);
    else ler(out);
  }

  function iniciar() {
    const b = GG.$("#btn-ouvir");
    if (!b) return;
    if (!tem()) { b.hidden = true; return; }
    b.onclick = lerTela;
    botao();
    // nas janelas que sobem de baixo (marcar, cobrar, mandar), um botão de ouvir ao lado do fechar
    GG.$$(".folha .cab").forEach((cab) => {
      const o = document.createElement("button");
      o.className = "btn-icone"; o.type = "button"; o.setAttribute("aria-label", "Ouvir esta janela"); o.innerHTML = GG.ic("falar", 24);
      o.onclick = () => lerFolha(cab.closest(".folha"));
      cab.querySelector("h2").after(o);
    });
    speechSynthesis.getVoices(); // alguns celulares só carregam as vozes depois do primeiro pedido
  }

  return { iniciar, ler, parar, lerTela, resumo: (v, f) => (resumos[v] = f), get falando() { return falando; } };
})();
