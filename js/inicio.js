/* GuGa · Hoje. No topo, a "câmera" do Guaíba: mapa de Porto Alegre com a água na altura de agora, a régua do
   Cais Mauá e o estado em letras grandes. Embaixo, só o essencial: a casa, quatro botões, mandar para a família, telefones. */
GG.inicio = (() => {
  const CAIS = [-51.2318, -30.0268]; // régua do Cais Mauá
  const R_MIN = 100, R_MAX = 600;
  let map = null, montado = false, nivelMostrado = null;
  const pct = (cm) => Math.max(0, Math.min(100, ((cm - R_MIN) / (R_MAX - R_MIN)) * 100));
  const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  function esqueleto() {
    const ag = GG.$("#agora"), G = GG.CONFIG.guaiba.caisMaua;
    ag.className = "vigia ligando";
    const ticks = `<div class="tick alerta" style="bottom:${pct(G.alerta)}%"><span>${GG.fmt(G.alerta / 100, 1)}</span></div><div class="tick inund" style="bottom:${pct(G.inundacao)}%"><span>${GG.fmt(G.inundacao / 100, 1)}</span></div>`;
    ag.innerHTML = `<div class="leitura" aria-live="polite"><span class="rotulo">Guaíba em Porto Alegre</span><span class="grande" id="vigia-num">—</span><span class="estado" id="vigia-estado"></span><p class="frase" id="vigia-frase"></p><p class="fonte" id="vigia-fonte"></p></div>
      <div class="tela" aria-hidden="true"><div class="mapa-v" id="mapa-vigia"></div>
        <div class="varredura"></div><div class="cantos"></div>
        <div class="alvo" id="vigia-alvo"><b>Cais Mauá</b></div>
        <div class="etiqueta"><span class="faixa"><span id="vigia-modo">Ao vivo</span></span></div>
        <div class="regua-v"><div class="agua" id="vigia-agua" style="height:0"></div>${ticks}</div>
      </div>`;
    setTimeout(() => ag.classList.remove("ligando"), 2400);
  }

  function criarMapa() {
    if (map || typeof maplibregl === "undefined") return;
    const preview = !!window.claude?.use;
    const style = { version: 8, sources: {}, layers: [{ id: "fundo", type: "background", paint: { "background-color": "#c6c9c1" } }] };
    if (!preview) {
      // foto de satélite em tons de cinza, como numa câmera de vigilância
      style.sources.sat = { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Imagem © Esri, Maxar" };
      style.layers.push({ id: "sat", type: "raster", source: "sat", paint: { "raster-saturation": -1, "raster-brightness-min": 0.22, "raster-contrast": 0.08, "raster-opacity": 0.95 } });
    }
    const pequeno = innerWidth < 760;
    map = new maplibregl.Map({
      container: "mapa-vigia", style, interactive: false, attributionControl: { compact: true, customAttribution: "IPH/UFRGS" },
      center: pequeno ? [-51.21, -30.015] : [-51.208, -30.012], zoom: pequeno ? 11.3 : 12, fadeDuration: 0,
    });
    let ok = false;
    const pronto = async () => {
      if (ok || !map.style?._loaded) return; ok = true;
      const [cotas, bairros, diques] = await Promise.all(["cotas", "bairros", "diques"].map((n) => GG.data.load(n).catch(() => null)));
      if (bairros) {
        map.addSource("b", { type: "geojson", data: bairros });
        map.addLayer({ id: "b-fill", type: "fill", source: "b", paint: { "fill-color": "#ecece7", "fill-opacity": preview ? 0.95 : 0 } });
      }
      if (cotas) {
        map.addSource("c", { type: "geojson", data: cotas });
        map.addLayer({ id: "rio", type: "fill", source: "c", filter: ["==", ["get", "cm"], 294], paint: { "fill-color": preview ? "#9db3c4" : "#5f7f99", "fill-opacity": preview ? 1 : 0.35 } });
        map.addLayer({ id: "agua", type: "fill", source: "c", filter: ["all", [">", ["get", "cm"], 294], ["<=", ["get", "cm"], 0]], paint: { "fill-color": "#2a7bbd", "fill-opacity": 0.72 } });
      }
      if (bairros) map.addLayer({ id: "b-ln", type: "line", source: "b", paint: { "line-color": "#232421", "line-opacity": 0.16, "line-width": 0.7 } });
      if (diques) {
        map.addSource("d", { type: "geojson", data: diques });
        map.addLayer({ id: "d-ln", type: "line", source: "d", paint: { "line-color": "#8c7a52", "line-width": 4 } });
        map.addLayer({ id: "d-ln2", type: "line", source: "d", paint: { "line-color": "#c4b28a", "line-width": 2 } });
      }
      posAlvo();
      if (nivelMostrado != null) subirAgua(nivelMostrado, true);
    };
    map.on("styledata", pronto); map.on("load", pronto); setTimeout(pronto, 60);
    map.on("move", posAlvo); map.on("resize", posAlvo);
  }

  function posAlvo() {
    const el = GG.$("#vigia-alvo");
    if (!map || !el) return;
    const p = map.project(CAIS);
    el.style.left = p.x + "px"; el.style.top = p.y + "px";
  }

  // a água sobe faixa por faixa até o nível de agora (uma vez, ao abrir)
  function subirAgua(cm, animar) {
    if (!map?.getLayer("agua")) return;
    if (!animar) { map.setFilter("agua", ["all", [">", ["get", "cm"], 294], ["<=", ["get", "cm"], cm]]); return; }
    const t0 = performance.now(), ini = 294, D = 1500;
    const passo = (t) => {
      const f = Math.min(1, (t - t0) / D), v = ini + (cm - ini) * (1 - Math.pow(1 - f, 3));
      map.setFilter("agua", ["all", [">", ["get", "cm"], 294], ["<=", ["get", "cm"], v]]);
      if (f < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  function contar(el, de, ate) {
    const t0 = performance.now(), D = 1300;
    const passo = (t) => { const f = Math.min(1, (t - t0) / D); el.textContent = GG.m(de + (ate - de) * (1 - Math.pow(1 - f, 3))); if (f < 1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  }

  function render() {
    if (!montado) { esqueleto(); montado = true; }
    criarMapa();
    requestAnimationFrame(() => { map?.resize(); posAlvo(); });
    const e = GG.estadoGuaiba(GG.live.nivel), ag = GG.$("#agora"), nv = GG.live.nivel;
    if (!e) {
      GG.$("#vigia-num").textContent = "—";
      GG.$("#vigia-estado").innerHTML = `<i></i>Sem leitura`;
      GG.$("#vigia-frase").textContent = "Acompanhe a Defesa Civil: 199.";
      GG.$("#vigia-fonte").textContent = "";
    } else {
      ag.classList.remove("normal", "atencao", "alerta", "inundacao"); ag.classList.add(e.nivel);
      const primeira = nivelMostrado == null;
      if (primeira) contar(GG.$("#vigia-num"), 100, e.cm); else GG.$("#vigia-num").textContent = GG.m(e.cm);
      GG.$("#vigia-estado").innerHTML = `<i></i>${e.rot}<span class="mov">${e.sobe ? `${GG.ic("setaCima", 18)}subindo ${GG.fmt(e.t.cmh, 0)} cm por hora` : e.desce ? `${GG.ic("setaBaixo", 18)}baixando` : "parado"}</span>`;
      GG.$("#vigia-frase").textContent = GG.FRASE_ESTADO[e.nivel];
      GG.$("#vigia-modo").textContent = e.simulado ? "Treino" : "Ao vivo";
      const f = GG.$("#vigia-fonte");
      f.className = "fonte" + (e.simulado ? " sim" : "");
      f.innerHTML = e.simulado ? "Leitura de treino." : `<i></i>ANA · Cais Mauá · ${nv?.serie?.length ? hora(nv.serie.at(-1).t) : ""}`;
      requestAnimationFrame(() => (GG.$("#vigia-agua").style.height = pct(e.cm) + "%"));
      subirAgua(e.cm, primeira);
      nivelMostrado = e.cm;
    }
    casa(e);
  }

  function casa(e) {
    const c = GG.casa.salva(), cx = GG.$("#inicio-casa"), r = e ? GG.casa.resumo(e) : null;
    cx.classList.toggle("alerta", !!r?.urgente);
    const desenho = `<span class="desenho">${GG.casa.svgCasa(r?.prof || null, true)}</span>`;
    if (c && r) cx.innerHTML = `${desenho}<span><small>Na sua casa${c.bairro ? ` · ${GG.esc(c.bairro)}` : ""}</small><b class="manchete">${r.manchete}</b><span class="sub">${r.subCurta}</span></span><span class="seta">${GG.ic("seta", 28)}</span>`;
    else cx.innerHTML = `${desenho}<span><small>Na sua casa</small><b class="manchete">A água chega?</b><span class="sub">Digite o endereço e veja, hora a hora.</span></span><span class="seta">${GG.ic("seta", 28)}</span>`;
  }

  async function tempo() {
    const box = GG.$("#inicio-tempo"), c = GG.casa.salva();
    const lat = c?.lat ?? -30.03, lon = c?.lon ?? -51.22;
    try {
      const [ch, t] = await Promise.all([GG.live.chuva(lat, lon), GG.live.tempo(lat, lon)]);
      const muita = ch.prox24 >= 50, venta = t.rajada >= 60;
      const avisos = [];
      if (t.granizo) avisos.push(`<a href="#guia" data-guia="granizo">${GG.ic("granizo", 28)}Pode cair granizo a partir das ${t.granizo.slice(11, 13)} h. Veja o que fazer.</a>`);
      if (venta) avisos.push(`<a href="#guia" data-guia="vento">${GG.ic("vento", 28)}Vento forte: até ${GG.fmt(t.rajada)} km/h. Veja o que fazer.</a>`);
      box.innerHTML = `<div class="tempo-hoje" aria-label="Previsão do tempo${c ? " na sua casa" : " em Porto Alegre"}">
          <div class="t ${muita ? "aviso" : ""}">${GG.ic(ch.prox24 >= 1 ? "chuva" : "sol", 30)}<b>${GG.fmt(ch.prox24)} mm</b><small>chuva em 24 h</small></div>
          <div class="t">${GG.ic("chuva", 30)}<b>${GG.fmt(ch.prox72)} mm</b><small>em 3 dias</small></div>
          <div class="t ${venta ? "aviso" : ""}">${GG.ic("vento", 30)}<b>${GG.fmt(t.rajada)}</b><small>km/h de vento</small></div>
        </div>${avisos.length ? `<div class="avisos-tempo">${avisos.join("")}</div>` : ""}`;
      GG.$$("[data-guia]", box).forEach((a) => a.onclick = (ev) => { ev.preventDefault(); GG.guia.fase(a.dataset.guia); GG.ir("guia"); });
    } catch { box.innerHTML = ""; }
  }

  async function clima() {
    try {
      const s = await fetch("data/situacao_atual.json").then((r) => r.json()), c = s.clima;
      if (!c || new Date().toISOString().slice(0, 10) > c.ate) return;
      GG.$("#inicio-clima").innerHTML = `<div class="clima"><span class="faixa"><span>Previsão</span></span><span><b>${GG.esc(c.titulo)}</b> <a class="peq" href="${GG.esc(c.url)}" target="_blank" rel="noopener">Fonte: ${GG.esc(c.fonte)}</a></span></div>`;
    } catch { /* sem aviso de clima */ }
  }

  function falar() {
    const e = GG.estadoGuaiba(GG.live.nivel), c = GG.casa.salva(), r = e ? GG.casa.resumo(e) : null;
    if (!e) return "Sem leitura do nível do Guaíba agora. Em caso de perigo, ligue 199.";
    const p = [`Guaíba em ${GG.m(e.cm)}. ${e.sobe ? `Subindo ${GG.fmt(e.t.cmh, 0)} cm por hora.` : e.desce ? "Baixando." : "Parado."}`, `Estado: ${e.rot}. ${GG.FRASE_ESTADO[e.nivel]}`];
    p.push(c && r ? `Na sua casa: ${r.manchete}. ${r.subCurta}` : "Toque em Minha casa para saber se a água chega na sua rua.");
    if (e.simulado) p.push("Atenção: este nível é de treino, não é o nível real.");
    p.push("Em perigo, ligue 193 para os Bombeiros ou 199 para a Defesa Civil.");
    return p;
  }

  function iniciar() {
    const T = GG.CONFIG.telefones.filter((t) => ["199", "193"].includes(t.n));
    GG.$("#inicio-tels").innerHTML = T.map((t) => `<a class="tel" href="tel:${t.n}"><span class="n">${t.n}</span><span class="nome">${t.nome}</span></a>`).join("");
    GG.on("nivel", () => !GG.$("#v-inicio").hidden && render());
    GG.on("casa", () => casa(GG.estadoGuaiba(GG.live.nivel)));
    GG.voz.resumo("inicio", falar);
    tempo(); clima();
    setInterval(tempo, 30 * 60 * 1000);
  }
  return { iniciar, render };
})();
