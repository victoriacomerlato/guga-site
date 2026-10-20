/* GuGa · Simulador de cheia. Arraste a régua: o mapa enche, a lista de bairros e a sua casa respondem na hora.
   Base: manchas hidrostáticas IPH/UFRGS (régua do Cais Mauá). Os "replays" de 1941 e 2024 são aproximados. */
GG.simulador = (() => {
  const MIN = 100, MAX = 700;
  let nivel = 300, ativo = false, diques = false, resumo = null, base = {}, tocando = null, guardado = null, chipOrig = null;
  const G = () => GG.CONFIG.guaiba.caisMaua;

  // marcas históricas na régua do Cais Mauá (m)
  const MARCAS = [
    { cm: 294, rot: "2015" }, { cm: 346, rot: "2023" }, { cm: 475, rot: "1941" }, { cm: 535, rot: "2024" },
  ];
  // replays aproximados (dias desde o início, cm). Servem para treinar, não como registro oficial.
  const REPLAY = {
    2024: { nome: "Maio de 2024", ini: "2024-04-29", pts: [[0, 130], [2, 220], [3, 310], [4, 425], [5, 500], [6, 535], [8, 520], [11, 470], [15, 520], [19, 450], [23, 380], [29, 300], [37, 220]] },
    1941: { nome: "Maio de 1941", ini: "1941-04-26", pts: [[0, 200], [5, 330], [9, 430], [12, 475], [16, 400], [22, 300], [30, 220]] },
  };

  const y2cm = (el, y) => { const r = el.getBoundingClientRect(); return Math.round(MAX - (Math.min(Math.max(y - r.top, 0), r.height) / r.height) * (MAX - MIN)); };
  const pct = (cm) => ((cm - MIN) / (MAX - MIN)) * 100;

  function html() {
    const linhas = [];
    for (let m = 2; m <= 7; m++) linhas.push(`<div class="marca-r" style="bottom:${pct(m * 100)}%"><span>${m} m</span></div>`);
    MARCAS.forEach((k) => linhas.push(`<div class="marca-r ev" style="bottom:${pct(k.cm)}%"><span>${k.rot}</span></div>`));
    return `<div class="sim-painel">
      <div class="sim-topo">
        <div class="regua" id="regua" tabindex="0" role="slider" aria-label="Altura do Guaíba" aria-valuemin="${MIN}" aria-valuemax="${MAX}">
          <div class="agua-r" id="agua-r"></div>${linhas.join("")}<div class="alca" id="alca"></div>
        </div>
        <div class="sim-leitura pilha" style="gap:6px;align-content:start">
          <span class="quando" id="sim-quando">Arraste a régua</span>
          <b class="numero" id="sim-num">—</b>
          <p id="sim-frase"></p>
          <div class="linha" style="gap:8px"><button class="btn" id="sim-menos" aria-label="Baixar 10 centímetros">− 10 cm</button><button class="btn" id="sim-mais" aria-label="Subir 10 centímetros">+ 10 cm</button></div>
        </div>
      </div>
      <p class="data-2024" id="sim-data" hidden></p>
      <div class="sim-play">
        <button class="btn" data-replay="2024">▶ Maio 2024</button>
        <button class="btn" data-replay="1941">▶ Maio 1941</button>
        <button class="btn" id="sim-zerar">Normal</button>
      </div>
      <label class="opcao"><input type="checkbox" id="sim-diques"><span>Diques e comportas funcionando<small>Em 2024 eles falharam. Desmarcado = como foi em 2024.</small></span></label>
      <div id="sim-casa"></div>
      <div class="sim-aviso" id="sim-aviso"></div>
      <div class="pilha" style="gap:8px"><h4 id="sim-bairros-t">Bairros com água</h4><div class="sim-bairros" id="sim-bairros"></div></div>
      <p class="nota">Simulação feita com o mapa de altitudes do IPH/UFRGS. Mostra onde a água chega para cada altura do Guaíba no Cais Mauá. Chuva forte local e bueiro entupido alagam antes disso.</p>
    </div>`;
  }

  function camadas(liga) {
    const map = GG.mapa.map;
    if (!map?.getLayer("cotas-fill")) return;
    if (liga) {
      const ocultar = ["mancha-fill", "infra-halo", "ebaps-pt", "comportas-pt", "relatos-halo", "relatos-pt", "abrigos-pt", "marcas-pt"].filter((id) => map.getLayer(id));
      guardado = guardado || [...ocultar, "cotas-fill"].reduce((o, id) => (o[id] = map.getLayoutProperty(id, "visibility") || "visible", o), {});
      ocultar.forEach((id) => map.setLayoutProperty(id, "visibility", "none"));
      map.setLayoutProperty("cotas-fill", "visibility", "visible");
      map.setPaintProperty("cotas-fill", "fill-opacity", 0.72);
    } else if (guardado) {
      Object.entries(guardado).forEach(([id, v]) => map.setLayoutProperty(id, "visibility", v));
      map.setFilter("cotas-fill", null);
      map.setPaintProperty("cotas-fill", "fill-color", ["interpolate", ["linear"], ["get", "cm"], 294, "#0b5f8f", 346, "#1281b8", 475, "#2fa3d6", 530, "#56bde6", 600, "#89d3f0", 700, "#c4e9f7"]);
      map.setPaintProperty("cotas-fill", "fill-opacity", 0.55);
      guardado = null;
    }
  }

  function pintar() {
    const map = GG.mapa.map;
    if (!ativo || !map?.getLayer("cotas-fill")) return;
    const f = ["all", ["<=", ["get", "cm"], nivel]];
    if (diques) f.push(["!=", ["get", "polder"], true]);
    map.setFilter("cotas-fill", f);
    // mais escuro onde a água fica mais funda
    map.setPaintProperty("cotas-fill", "fill-color", ["interpolate", ["linear"], ["-", nivel, ["get", "cm"]], 0, "#8cc8ee", 60, "#4fa2da", 150, "#2a7cbf", 300, "#17518a"]);
  }

  function fundura(cm) {
    if (cm <= 0) return { t: "Seca", c: "ok" };
    if (cm < 20) return { t: "Água na rua e na calçada", c: "atencao" };
    if (cm < 50) return { t: "Água entra pela porta", c: "saia" };
    if (cm < 100) return { t: "Água acima do joelho dentro de casa", c: "saia" };
    if (cm < 260) return { t: "Água na altura da janela", c: "saia" };
    return { t: "Água perto do teto", c: "saia" };
  }

  function atualizar() {
    const R = GG.$("#regua");
    if (!R) return;
    GG.$("#agua-r").style.height = pct(nivel) + "%";
    GG.$("#alca").style.bottom = pct(nivel) + "%";
    const chip = GG.$("#chip-nivel"); if (chip) chip.innerHTML = `<span class="pt"></span>Simulando: Guaíba ${GG.m(nivel)}`;
    R.setAttribute("aria-valuenow", nivel);
    R.setAttribute("aria-valuetext", GG.m(nivel));
    GG.$("#sim-num").textContent = GG.m(nivel);
    const ev = [...MARCAS].reverse().find((k) => nivel >= k.cm - 8);
    const nomeEv = { "2015": "outubro de 2015", "2023": "novembro de 2023", "1941": "maio de 1941", "2024": "maio de 2024" };
    const g = G();
    GG.$("#sim-quando").textContent = nivel >= g.inundacao ? "Cota de inundação" : nivel >= g.alerta ? "Cota de alerta" : "Nível normal";
    GG.$("#sim-frase").innerHTML = ev ? `Parecido com a cheia de <b>${nomeEv[ev.rot]}</b>.` : "Sem água nas ruas por causa do Guaíba.";

    // bairros: diferença em relação ao nível mais baixo do mapa (os polígonos de bairro incluem parte do rio)
    if (resumo) {
      const b0 = Object.fromEntries(resumo[0].bairros.map((b) => [b.n, b.p]));
      const r = [...resumo].reverse().find((x) => x.cm <= nivel);
      const lista = r ? r.bairros.map((b) => ({ n: b.n, d: b.p - (r === resumo[0] ? 0 : b0[b.n] || 0) })).filter((b) => b.d >= 5 && r !== resumo[0]).sort((a, b) => b.d - a.d) : [];
      GG.$("#sim-bairros-t").textContent = lista.length ? `${lista.length} bairros com água · ${GG.fmt(r.km2, 1)} km² de cidade alagada` : "Bairros com água";
      GG.$("#sim-bairros").innerHTML = lista.length ? lista.map((b) => `<span>${GG.esc(b.n)} <small class="mono">${b.d}%</small></span>`).join("") : `<p class="mut">Nenhum bairro com água do Guaíba nesse nível.</p>`;
      if (diques && lista.length) GG.$("#sim-bairros-t").textContent += " (sem contar os diques)";
    }

    // minha casa
    const casa = GG.casa.salva(), cx = GG.$("#sim-casa");
    let fase = nivel >= g.inundacao ? "atencao" : "ok";
    if (casa?.faixa) {
      const { cm, prev } = casa.faixa, prot = diques && casa.polder;
      const a = prot ? 0 : Math.max(0, nivel - cm), b = prot ? 0 : Math.max(0, nivel - Math.max(prev || 0, 100));
      const ini = Math.max(prev || 0, 100), d = fundura(prot ? 0 : Math.max(0, Math.round(nivel - (ini + cm) / 2))), falta = ini - nivel;
      fase = b > 0 ? "saia" : falta <= 30 ? "atencao" : fase;
      cx.innerHTML = `<div class="sim-aviso ${d.c}"><span class="mut">Na sua casa (${GG.esc(casa.rotulo || "salva")})</span><b class="f">${b > 0 ? (d.c === "ok" ? "Pode chegar água na rua" : d.t) : prot ? "Protegida pelo dique" : "Seca"}</b>
        <span>${b > 0 ? `Entre <b>${a}</b> e <b>${b} cm</b> de água na frente da casa. O mapa não sabe a altura exata do seu terreno.` : falta > 0 && !prot ? `A água começa a chegar na sua rua com <b>${GG.m(ini)}</b>. Faltam ${falta} cm.` : ""}</span></div>`;
    } else {
      cx.innerHTML = `<a class="opcao" href="#casa" data-nav="casa">Salve sua casa para ver a água nela<small>Leva 30 segundos. Fica só no seu celular.</small></a>`;
    }

    // o aviso que a pessoa receberia
    const A = GG.$("#sim-aviso");
    const txt = {
      ok: ["🟢 Sem alerta", "Rio tranquilo. Bom momento para deixar a mochila pronta."],
      atencao: ["🟡 Atenção", "O Guaíba está subindo. Suba documentos e remédios, carregue o celular e combine com a família para onde ir."],
      saia: ["🔴 Saia agora", "Desligue a luz no quadro. Leve documentos, remédios e os animais. Vá para um lugar alto. Não volte para buscar coisas."],
    }[fase];
    A.className = "sim-aviso " + fase;
    A.innerHTML = `<span class="mut">O aviso que você receberia no WhatsApp</span><b class="f">${txt[0]}</b><span>${txt[1]}</span>`;
    pintar();
  }

  function set(cm) { nivel = Math.max(MIN, Math.min(MAX, Math.round(cm))); atualizar(); }

  function parar() { if (tocando) cancelAnimationFrame(tocando); tocando = null; GG.$("#sim-data") && (GG.$("#sim-data").hidden = true); }

  function replay(id) {
    parar();
    const R = REPLAY[id], fim = R.pts.at(-1)[0], DUR = 14000, t0 = performance.now();
    const ini = new Date(R.ini + "T12:00");
    const el = GG.$("#sim-data"); el.hidden = false;
    const passo = (now) => {
      const dia = Math.min(fim, ((now - t0) / DUR) * fim);
      let i = R.pts.findIndex((p) => p[0] > dia); if (i < 1) i = R.pts.length - 1;
      const [d0, c0] = R.pts[i - 1], [d1, c1] = R.pts[i];
      set(c0 + (c1 - c0) * Math.min(1, (dia - d0) / (d1 - d0 || 1)));
      const data = new Date(ini.getTime() + dia * 864e5);
      el.textContent = `${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · aproximado`;
      tocando = dia < fim ? requestAnimationFrame(passo) : null;
    };
    tocando = requestAnimationFrame(passo);
  }

  async function montar(box) {
    box.innerHTML = html();
    if (!resumo) resumo = await fetch("data/poa_cotas_resumo.json").then((r) => r.json()).catch(() => null);
    const R = GG.$("#regua");
    let arrastando = false;
    R.addEventListener("pointerdown", (e) => { parar(); arrastando = true; R.setPointerCapture(e.pointerId); set(y2cm(R, e.clientY)); });
    R.addEventListener("pointermove", (e) => arrastando && set(y2cm(R, e.clientY)));
    R.addEventListener("pointerup", () => (arrastando = false));
    R.addEventListener("keydown", (e) => {
      const d = { ArrowUp: 10, ArrowRight: 10, ArrowDown: -10, ArrowLeft: -10, PageUp: 50, PageDown: -50 }[e.key];
      if (d) { e.preventDefault(); parar(); set(nivel + d); }
    });
    GG.$("#sim-mais").onclick = () => { parar(); set(nivel + 10); };
    GG.$("#sim-menos").onclick = () => { parar(); set(nivel - 10); };
    GG.$("#sim-zerar").onclick = () => { parar(); set(150); };
    GG.$$("[data-replay]", box).forEach((b) => (b.onclick = () => replay(b.dataset.replay)));
    GG.$("#sim-diques").onchange = (e) => { diques = e.target.checked; atualizar(); };
    atualizar();
  }

  async function ligar(on) {
    if (on && chipOrig == null) chipOrig = GG.$("#chip-nivel").innerHTML;
    ativo = on;
    GG.$("#v-mapa").classList.toggle("simulando", on);
    GG.$$(".modos button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.modo === "simular") === on)));
    GG.$("#lat-hoje").hidden = on;
    const box = GG.$("#lat-sim"); box.hidden = !on;
    if (on && !box.firstChild) await montar(box);
    if (!on) { parar(); if (chipOrig != null) GG.$("#chip-nivel").innerHTML = chipOrig; chipOrig = null; }
    const espera = () => GG.mapa.map?.getLayer("cotas-fill") ? (camadas(on), on && pintar(), on && (GG.mapa.map.resize(), GG.mapa.map.flyTo({ center: [-51.19, -30.02], zoom: innerWidth < 900 ? 10.9 : 11.6, duration: 900 }))) : setTimeout(espera, 200);
    espera();
    if (on) { const s = GG.casa.salva(); if (s?.faixa && nivel === 300) set(Math.min(MAX, s.faixa.cm + 20)); else atualizar(); }
  }

  function iniciar() {
    GG.$$(".modos button").forEach((b) => (b.onclick = () => ligar(b.dataset.modo === "simular")));
  }

  return { iniciar, ligar, set, get ativo() { return ativo; }, get nivel() { return nivel; } };
})();
