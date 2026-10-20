/* GuGa · mapa vivo (MapLibre). Verde = ok; vermelho piscando = problema ativo. */
GG.mapa = (() => {
  let map, popup, pronto = false, escolhendo = null, demoLigado = true, municipios = [], bairrosFC = null;
  const filtro = { cidade: "Porto Alegre", bairro: "" };
  const cor = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const camadasUI = [
    { id: "relatos", rot: "Marcações da população", sw: "var(--crit)", on: true, layers: ["relatos-halo", "relatos-pt"] },
    { id: "infra", rot: "Casas de bombas (situação em 2026)", sw: "var(--alert)", on: true, layers: ["infra-halo", "ebaps-pt", "comportas-pt"] },
    { id: "diques", rot: "Diques", sw: "var(--warn)", on: true, layers: ["polders-fill", "diques-ln"] },
    { id: "mancha", rot: "Onde alagou em 2024", sw: "var(--water)", on: true, layers: ["mancha-fill"] },
    { id: "cotas", rot: "Até onde a água chega, por altura (Porto Alegre)", sw: "linear-gradient(90deg,#0b6a9c,#7fd3f5)", on: false, layers: ["cotas-fill"] },
    { id: "abrigos", rot: "Abrigos usados em 2024", sw: "var(--info)", on: false, layers: ["abrigos-pt"] },
    { id: "marcas", rot: "Altura da água medida em 2024", sw: "var(--water)", on: false, layers: ["marcas-pt"] },
    { id: "deslizamentos", rot: "Deslizamentos de 2024 (Serra)", sw: "#c98a4b", on: false, layers: ["desl-fill"] },
  ];

  const fc = (features) => ({ type: "FeatureCollection", features });

  function relatosVisiveis() {
    const reais = GG.backend.relatos().filter((r) => r.status !== "rejeitado");
    const lista = reais.length === 0 && demoLigado ? GG.modelo.exemplos() : reais;
    return lista;
  }

  function featuresRelatos() {
    const autoridade = GG.backend.papel() === "autoridade";
    return fc(relatosVisiveis().map((r) => {
      let { lon, lat } = r;
      if ((r.tipo === "sos" || r.tipo === "animais") && !autoridade) { // privacidade: posição aproximada (~150 m) para o público
        lon = Math.round(lon / 0.0015) * 0.0015; lat = Math.round(lat / 0.0015) * 0.0015;
      }
      const prob = GG.modelo.problema(r) && GG.modelo.ativo(r);
      const grupo = GG.modelo.TIPOS[r.tipo]?.grupo || "situacao";
      return {
        type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] },
        properties: { id: r.id, grupo, sub: r.sub, status: r.status, prob: prob ? 1 : 0, sos: grupo === "sos" && GG.modelo.ativo(r) ? 1 : 0, demo: r.demo ? 1 : 0 },
      };
    }));
  }

  /** mapa base: vetorial do OpenFreeMap (OpenStreetMap, com nome de todas as ruas, de graça e sem chave).
      Sem ele (sem internet ou fora do ar), usa o CARTO com nomes; na prévia do claude.ai, só os bairros. */
  async function estiloBase(preview) {
    const vazio = { version: 8, sources: {}, layers: [{ id: "fundo", type: "background", paint: { "background-color": preview ? "rgba(0,0,0,0)" : "#eef1f4" } }] };
    if (preview) return { style: vazio, vetor: false };
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
      const st = await fetch(GG.CONFIG.fontes.estiloMapa, { signal: ctl.signal }).then((r) => r.ok ? r.json() : Promise.reject(new Error("estilo")));
      clearTimeout(to);
      return { style: st, vetor: true };
    } catch {
      vazio.sources.base = { type: "raster", tiles: [GG.CONFIG.fontes.mapaReserva], tileSize: 256, attribution: "© OpenStreetMap © CARTO" };
      vazio.layers.push({ id: "base", type: "raster", source: "base" });
      return { style: vazio, vetor: false };
    }
  }

  async function iniciar() {
    const el = GG.$("#mapa");
    const preview = !!window.claude?.use;
    const { style, vetor } = await estiloBase(preview);
    map = new maplibregl.Map({
      container: el, style, center: [-51.2, -30.04], zoom: 11.2, attributionControl: { compact: true, customAttribution: "Dados: IPH/UFRGS et al. (CC BY 4.0)" + (vetor ? " · Mapa: OpenFreeMap" : "") },
      dragRotate: false, pitchWithRotate: false, maxPitch: 0,
    });
    GG.mapa.vetor = vetor;
    if (marcarCasa.pendente) { marcarCasa(...marcarCasa.pendente); marcarCasa.pendente = null; }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right"); // embaixo ficam os botões flutuantes
    popup = new maplibregl.Popup({ closeButton: true, maxWidth: "340px" });
    // não espera o evento "load": sem internet os tiles de fundo falham devagar e atrasariam tudo
    let comecou = false;
    const comecar = async () => {
      if (comecou || !map.style?._loaded) return;
      comecou = true;
      await adicionarCamadas(preview);
      pronto = true;
      GG.backend.ouvir(() => atualizarRelatos());
      piscar();
      irPara(filtro.cidade);
    };
    map.on("style.load", comecar);
    map.on("styledata", comecar);
    map.on("load", comecar);
    setTimeout(comecar, 50);
    map.on("click", onClick);
    preencherFiltros();
    desenharCamadasUI();
    GG.on("backend", () => pronto && atualizarRelatos());
  }

  async function adicionarCamadas(preview) {
    const D = GG.data;
    const add = async (id, nome) => { try { map.addSource(id, { type: "geojson", data: await D.load(nome) }); return true; } catch (e) { console.warn(e); return false; } };
    await Promise.all([add("cotas", "cotas"), add("bairros", "bairros"), add("polders", "polders"), add("diques", "diques"),
      add("comportas", "comportas"), add("ebaps", "ebaps"), add("abrigos", "abrigos"), add("marcas", "marcas"),
      add("mancha", "mancha"), add("bacia", "bacia")]);
    bairrosFC = await D.load("bairros").catch(() => null);
    // situação das casas de bombas em 2026 (relatório do DMAE) junto com o histórico de 2024
    try {
      const sit = await fetch("data/situacao_atual.json").then((r) => r.json()), E = sit.ebaps_poa;
      const eb = await D.load("ebaps");
      eb.features.forEach((f) => {
        const p = f.properties;
        if (p.municipio !== "Porto Alegre") return;
        const m = p.ebap.match(/CB (\d+[AB]?)/), nome = Object.keys(E.nomes).find((n) => p.ebap.includes(n));
        const num = m ? m[1].padStart(m[1].length === 1 ? 2 : m[1].length, "0") : nome ? E.nomes[nome] : null;
        const st = num && E.por_numero[num];
        if (st) Object.assign(p, { num, cap2026: st.cap, gerador2026: st.gerador, fonte2026: `${E.fonte}, ${new Date(E.data + "T12:00").toLocaleDateString("pt-BR")}` });
      });
      map.getSource("ebaps")?.setData(eb);
    } catch { /* sem situação atual */ }
    map.addSource("relatos", { type: "geojson", data: fc([]) });
    map.addSource("sel", { type: "geojson", data: fc([]) });

    const water = cor("--water"), acc = cor("--accent"), crit = cor("--crit"), warn = cor("--warn"), alert = cor("--alert"), line = cor("--line2"), fg = cor("--fg");
    const rotulo = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
    const L = (o) => { if (map.getSource(o.source)) map.addLayer(o, ["fill", "line"].includes(o.type) ? rotulo : undefined); };
    // água do mapa base no mesmo azul claro do app
    map.getStyle().layers.filter((l) => /water/i.test(l.id) && l.type === "fill").forEach((l) => map.setPaintProperty(l.id, "fill-color", "#cfe2f3"));
    L({ id: "bacia-ln", type: "line", source: "bacia", paint: { "line-color": cor("--brown"), "line-opacity": 0.35, "line-width": 1.2, "line-dasharray": [4, 3] } });
    L({ id: "cotas-fill", type: "fill", source: "cotas", layout: { visibility: "none" }, paint: {
      "fill-color": ["interpolate", ["linear"], ["get", "cm"], 294, "#0b5f8f", 346, "#1281b8", 475, "#2fa3d6", 530, "#56bde6", 600, "#89d3f0", 700, "#c4e9f7"],
      "fill-opacity": 0.55 } });
    // na prévia não há mapa de fundo: desenha a terra (bairros) e o rio (faixa mais baixa das cotas)
    L({ id: "bairros-fill", type: "fill", source: "bairros", paint: { "fill-color": preview ? "#f4f6f8" : acc, "fill-opacity": preview ? 0.95 : 0 } });
    L({ id: "mancha-fill", type: "fill", source: "mancha", paint: { "fill-color": water, "fill-opacity": 0.3 } });
    if (preview) L({ id: "rio-fill", type: "fill", source: "cotas", filter: ["==", ["get", "cm"], 294], paint: { "fill-color": "#cfe2f3", "fill-opacity": 1 } });
    if (map.getLayer("cotas-fill")) map.moveLayer("cotas-fill", rotulo); // a água simulada fica por cima da terra, embaixo dos nomes
    L({ id: "bairros-ln", type: "line", source: "bairros", paint: { "line-color": "#14202b", "line-opacity": 0.22, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 1.4] } });
    L({ id: "polders-fill", type: "fill", source: "polders", paint: { "fill-color": warn, "fill-opacity": 0.05 } });
    L({ id: "diques-ln", type: "line", source: "diques", paint: { "line-color": "#8c7a52", "line-width": 3.5, "line-opacity": 0.95 } });
    map.addLayer({ id: "sel-ln", type: "line", source: "sel", paint: { "line-color": fg, "line-width": 3 } }, rotulo);
    L({ id: "abrigos-pt", type: "circle", source: "abrigos", layout: { visibility: "none" }, paint: { "circle-radius": 5, "circle-color": cor("--info"), "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
    L({ id: "marcas-pt", type: "circle", source: "marcas", layout: { visibility: "none" }, paint: { "circle-radius": 4, "circle-color": water, "circle-stroke-color": "#003049", "circle-stroke-width": 1 } });
    // infraestrutura: o que falhou em 2024 pisca em vermelho
    // pisca em vermelho a casa de bombas que hoje não funciona com força total
    L({ id: "infra-halo", type: "circle", source: "ebaps", filter: ["<", ["coalesce", ["get", "cap2026"], 100], 100], paint: { "circle-radius": 13, "circle-color": crit, "circle-opacity": 0.3, "circle-blur": 0.5 } });
    L({ id: "ebaps-pt", type: "circle", source: "ebaps", paint: {
      "circle-radius": 6, "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff",
      "circle-color": ["case", ["!", ["has", "cap2026"]], "#7a8c82", ["<", ["get", "cap2026"], 100], crit, acc] } });
    L({ id: "comportas-pt", type: "circle", source: "comportas", paint: { "circle-radius": 5, "circle-color": ["case", ["get", "falhou_2024"], crit, warn], "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" } });
    // relatos
    map.addLayer({ id: "relatos-halo", type: "circle", source: "relatos", filter: ["==", ["get", "prob"], 1], paint: {
      "circle-radius": ["case", ["==", ["get", "sos"], 1], 18, 12], "circle-color": crit, "circle-opacity": 0.3, "circle-blur": 0.5 } });
    map.addLayer({ id: "relatos-pt", type: "circle", source: "relatos", paint: {
      "circle-radius": ["case", ["==", ["get", "sos"], 1], 8, 6.5],
      "circle-color": ["case",
        ["==", ["get", "status"], "resolvido"], acc,
        ["==", ["get", "status"], "em_atendimento"], cor("--info"),
        ["==", ["get", "prob"], 1], crit, acc],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff" } });
    camadasUI.forEach((c) => visivel(c.id, c.on));
  }

  function atualizarRelatos() {
    if (!pronto) return;
    map.getSource("relatos").setData(featuresRelatos());
    painelLateral();
  }

  // pisca a 1 Hz (desacelera com movimento reduzido)
  function piscar() {
    const lento = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let on = true;
    setInterval(() => {
      on = !on;
      const o = on ? 0.55 : 0.05;
      if (map.getLayer("relatos-halo")) map.setPaintProperty("relatos-halo", "circle-opacity", o);
      if (map.getLayer("infra-halo")) map.setPaintProperty("infra-halo", "circle-opacity", o);
    }, lento ? 1600 : 550);
  }

  async function visivel(id, on) {
    const c = camadasUI.find((x) => x.id === id);
    c.on = on;
    if (!map || !map.getSource("relatos")) return;
    if (id === "deslizamentos" && on && !map.getSource("desl")) { // 4 MB: só carrega quando pedem
      try {
        map.addSource("desl", { type: "geojson", data: await GG.data.load("deslizamentos") });
        map.addLayer({ id: "desl-fill", type: "fill", source: "desl", paint: { "fill-color": "#c98a4b", "fill-opacity": 0.75 } }, "bairros-fill");
        map.fitBounds([[-52.3, -29.6], [-51.3, -28.9]], { duration: 900 });
      } catch { GG.toast("Não consegui carregar os deslizamentos.", "erro"); return; }
    }
    c.layers.forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, "visibility", on ? "visible" : "none"));
  }

  function desenharCamadasUI() {
    const box = GG.$("#camadas");
    box.innerHTML = camadasUI.map((c) => `<label><input type="checkbox" id="cam-${c.id}" ${c.on ? "checked" : ""}><span class="sw" style="background:${c.sw}"></span>${c.rot}</label>`).join("");
    camadasUI.forEach((c) => GG.$("#cam-" + c.id).addEventListener("change", (e) => visivel(c.id, e.target.checked)));
  }

  async function preencherFiltros() {
    try { municipios = await GG.data.load("municipios"); } catch { municipios = [{ nome: "Porto Alegre", lat: -30.04, lon: -51.2, bbox: [-51.31, -30.27, -51.01, -29.93] }]; }
    const sc = GG.$("#f-cidade");
    const rh = municipios.filter((m) => m.rh_guaiba), outros = municipios.filter((m) => !m.rh_guaiba);
    sc.innerHTML = `<optgroup label="Bacia do Guaíba">${rh.map((m) => `<option ${m.nome === filtro.cidade ? "selected" : ""}>${GG.esc(m.nome)}</option>`).join("")}</optgroup>
      <optgroup label="Outras cidades do RS">${outros.map((m) => `<option>${GG.esc(m.nome)}</option>`).join("")}</optgroup>`;
    sc.addEventListener("change", () => { filtro.cidade = sc.value; filtro.bairro = ""; preencherBairros(); irPara(sc.value); GG.store.set("cidade", sc.value); });
    const salva = GG.store.get("cidade", null);
    if (salva && municipios.some((m) => m.nome === salva)) { filtro.cidade = salva; sc.value = salva; }
    preencherBairros();
  }
  async function preencherBairros() {
    const sb = GG.$("#f-bairro");
    if (filtro.cidade !== "Porto Alegre") { sb.innerHTML = `<option value="">Cidade inteira</option>`; sb.disabled = true; return; }
    const b = await GG.data.load("bairros");
    sb.disabled = false;
    const nomes = b.features.map((f) => f.properties.bairro).sort((a, c) => a.localeCompare(c, "pt-BR"));
    sb.innerHTML = `<option value="">Cidade inteira</option>` + nomes.map((n) => `<option>${GG.esc(n)}</option>`).join("");
    sb.onchange = () => { filtro.bairro = sb.value; irParaBairro(sb.value); };
  }
  function irPara(nome) {
    const m = municipios.find((x) => x.nome === nome);
    if (!m || !map) return;
    map.getSource("sel")?.setData(fc([]));
    map.fitBounds([[m.bbox[0], m.bbox[1]], [m.bbox[2], m.bbox[3]]], { padding: 30, duration: 900, maxZoom: 13 });
    painelLateral();
  }
  function irParaBairro(nome) {
    if (!nome) return irPara(filtro.cidade);
    const f = bairrosFC?.features.find((x) => x.properties.bairro === nome);
    if (!f) return;
    map.getSource("sel").setData(fc([f]));
    map.fitBounds([[f.bbox[0], f.bbox[1]], [f.bbox[2], f.bbox[3]]], { padding: 40, duration: 900 });
    painelLateral();
  }

  function naArea(r) {
    if (filtro.bairro) return r.bairro === filtro.bairro;
    const m = municipios.find((x) => x.nome === filtro.cidade);
    if (!m) return true;
    const b = m.bbox;
    return r.lon >= b[0] && r.lon <= b[2] && r.lat >= b[1] && r.lat <= b[3];
  }

  function painelLateral() {
    const todos = relatosVisiveis();
    const demo = todos.some((r) => r.demo);
    const rs = todos.filter(naArea);
    const bue = rs.filter((r) => r.tipo === "bueiro");
    const bueProb = bue.filter((r) => GG.modelo.problema(r) && GG.modelo.ativo(r)).length;
    const bueOk = bue.filter((r) => !GG.modelo.problema(r) || r.status === "resolvido").length;
    const sos = rs.filter((r) => (r.tipo === "sos" || r.tipo === "animais") && GG.modelo.ativo(r)).length;
    const alag = rs.filter((r) => r.tipo === "situacao" && ["inundando", "inundado"].includes(r.sub) && GG.modelo.ativo(r)).length;
    const area = filtro.bairro || filtro.cidade;
    GG.$("#resumo-area").innerHTML = `
      <p class="resumo">${GG.esc(area)}: ${bueProb ? `<b class="c">${bueProb}</b> bueiro${bueProb > 1 ? "s" : ""} com problema` : "nenhum bueiro com problema marcado"}${alag ? `, <b class="c">${alag}</b> ponto${alag > 1 ? "s" : ""} alagando` : ""}${sos ? `, <b class="c">${sos}</b> pedido${sos > 1 ? "s" : ""} de socorro` : ""}.</p>
      ${demo ? `<p class="demo-faixa">Pontos de exemplo, ainda sem marcações reais. <button id="ocultar-demo">Esconder</button></p>` : ""}`;
    GG.$("#ocultar-demo")?.addEventListener("click", () => { demoLigado = false; atualizarRelatos(); });
    const lista = rs.filter((r) => GG.modelo.ativo(r)).sort((a, b) => (GG.modelo.problema(b) - GG.modelo.problema(a)) || (new Date(b.criadoEm) - new Date(a.criadoEm))).slice(0, 12);
    GG.$("#lista-relatos").innerHTML = lista.length ? lista.map((r) => {
      const t = GG.modelo.TIPOS[r.tipo], p = GG.modelo.problema(r);
      return `<button class="item-relato" data-id="${r.id}"><span class="bola ${p ? "pisca" : ""}" style="background:${p ? "var(--crit)" : "var(--accent)"}"></span>
        <span><b>${GG.esc(t?.subs[r.sub]?.rotulo || t?.rotulo)}</b><br><span class="mut">${GG.esc(r.bairro || r.cidade || "")} · ${GG.tempo(r.criadoEm)}${r.confirmacoes ? ` · ${r.confirmacoes} confirmações` : ""}</span>
        ${r.demo ? ` <span class="tag demo">exemplo</span>` : ""}</span></button>`;
    }).join("") : `<p class="mut">Nada marcado nesta área.</p>`;
    GG.$$("#lista-relatos .item-relato").forEach((b) => b.addEventListener("click", () => abrirRelato(b.dataset.id, true)));
  }

  function abrirRelato(id, voar) {
    const r = relatosVisiveis().find((x) => x.id === id);
    if (!r) return;
    const t = GG.modelo.TIPOS[r.tipo];
    const est = GG.modelo.ESTADOS[r.status] || GG.modelo.ESTADOS.aberto;
    const autoridade = GG.backend.papel() === "autoridade";
    const pr = GG.modelo.prioridade(r);
    const s = r.sos || {};
    const sosTxt = r.tipo === "sos" ? `<p><b>${s.pessoas || 1} pessoa(s)</b>${s.criancas ? ` · ${s.criancas} criança/bebê` : ""}${s.idosos ? ` · ${s.idosos} idoso(s)` : ""}${s.pcd ? " · acamado/PcD" : ""}${s.animais ? ` · ${s.animais} animal(is)` : ""}</p>`
      : r.tipo === "animais" ? `<p><b>${s.animais || 1} animal(is)</b> · ${GG.esc((s.especies || []).join(", "))}</p>` : "";
    const ag = GG.modelo.AGUA.find((a) => a.id === s.agua);
    const html = `<div class="pop">
      <div class="linha" style="gap:6px;margin-bottom:6px"><span class="tag ${est.cor}">${est.rotulo}</span>${r.demo ? `<span class="tag demo">exemplo fictício</span>` : ""}</div>
      <h4>${GG.esc(t?.subs[r.sub]?.rotulo || t?.rotulo)}</h4>
      ${sosTxt}${ag ? `<p>Água: <b>${ag.rotulo.toLowerCase()}</b></p>` : ""}
      ${pr.total ? `<p>Prioridade de resgate: <b class="mono">${pr.total}</b> (${GG.modelo.faixaPrioridade(pr.total).rot})</p>` : ""}
      ${r.descricao ? `<p>${GG.esc(r.descricao)}</p>` : ""}
      <p class="mut">${GG.esc(r.bairro || "")} ${r.cidade ? "· " + GG.esc(r.cidade) : ""} · ${GG.tempo(r.criadoEm)} · ${r.confirmacoes || 0} confirmação(ões)</p>
      ${(r.tipo === "sos" || r.tipo === "animais") && !autoridade ? `<p class="mut" style="font-size:.85rem">Posição aproximada (~150 m) para proteger quem pediu ajuda. Equipes de resgate veem o ponto exato.</p>` : ""}
      <div class="fotos">${(r.fotos || []).slice(0, 2).map((f) => `<img src="${GG.esc(f.url)}" alt="Foto enviada pelo cidadão">`).join("")}</div>
      <div class="acoes">
        ${GG.modelo.ativo(r) && GG.modelo.problema(r) && r.tipo !== "sos" && r.tipo !== "animais" ? `<button class="btn primario" data-acao="cobrar">Cobrar</button>` : ""}
        ${!r.demo && GG.modelo.ativo(r) ? `<button class="btn" data-acao="confirmar">Eu também vi</button>` : ""}
        ${!r.demo && GG.modelo.ativo(r) && GG.modelo.problema(r) && r.tipo !== "sos" && r.tipo !== "animais" ? (r.conserto ? `<span class="tag warn">Avisaram que foi arrumado · esperando validação</span>` : `<button class="btn" data-acao="arrumado">Foi arrumado</button>`) : ""}
        ${autoridade && !r.demo ? `<select data-acao="status" aria-label="Mudar situação">${Object.entries(GG.modelo.ESTADOS).map(([k, v]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${v.rotulo}</option>`).join("")}</select>` : ""}
      </div></div>`;
    if (voar) map.flyTo({ center: [r.lon, r.lat], zoom: Math.max(map.getZoom(), 15), duration: 700 });
    popup.setLngLat([r.lon, r.lat]).setHTML(html).addTo(map);
    const el = popup.getElement();
    el.querySelector('[data-acao="cobrar"]')?.addEventListener("click", () => GG.cobrar.abrir({ relato: r }));
    el.querySelector('[data-acao="confirmar"]')?.addEventListener("click", async (e) => {
      try { await GG.backend.confirmar(r.id); GG.toast("Obrigado. Sua confirmação aumenta a prioridade."); e.target.disabled = true; } catch (err) { GG.toast(err.message, "erro"); }
    });
    el.querySelector('[data-acao="arrumado"]')?.addEventListener("click", async (e) => {
      try { await GG.backend.pedirConserto(r.id, null); GG.toast("Obrigado! A equipe GuGa vai conferir. Se puder, mande uma foto pelo De Olho na Rua."); e.target.disabled = true; } catch (err) { GG.toast(err.message, "erro"); }
    });
    el.querySelector('[data-acao="status"]')?.addEventListener("change", async (e) => {
      try { await GG.backend.atualizar(r.id, { status: e.target.value }); GG.toast("Situação atualizada e registrada no histórico público."); } catch (err) { GG.toast(err.message, "erro"); }
    });
  }

  function onClick(e) {
    if (escolhendo) { const f = escolhendo; escolhendo = null; GG.$("#mira").hidden = true; f({ lon: e.lngLat.lng, lat: e.lngLat.lat }); return; }
    const hits = map.queryRenderedFeatures(e.point, { layers: ["relatos-pt", "ebaps-pt", "comportas-pt", "abrigos-pt", "marcas-pt"].filter((l) => map.getLayer(l)) });
    if (!hits.length) {
      const b = map.queryRenderedFeatures(e.point, { layers: ["bairros-fill"] })[0];
      if (b) { GG.$("#f-bairro").value = b.properties.bairro; filtro.bairro = b.properties.bairro; irParaBairro(b.properties.bairro); }
      return;
    }
    const h = hits[0], p = h.properties;
    if (h.layer.id === "relatos-pt") return abrirRelato(p.id);
    let html = "";
    if (h.layer.id === "ebaps-pt") {
      const nome = p.num ? `Casa de bombas ${p.num.replace(/^0/, "")}` : "Casa de bombas";
      const local = String(p.ebap).replace(/^EBAP_[A-Z]{2}_CB[ _]?(\d+[AB]?_)?/, "").replace(/_/g, " ");
      html = `<h4>${nome} · ${GG.esc(local)}</h4><p class="mut">${GG.esc(p.municipio)}</p>
        ${p.cap2026 != null ? `<p>Hoje: <b style="color:${p.cap2026 < 100 ? "var(--crit)" : "var(--accent)"}">${p.cap2026}% da força</b>${p.gerador2026 === true || p.gerador2026 === "true" ? " · com gerador" : " · <b>sem gerador próprio</b>"}</p><p class="mut peq">${GG.esc(p.fonte2026)}</p>` : `<p>Situação atual não publicada.</p>`}
        ${p.dias_inoperante ? `<p>Em maio de 2024 ficou <b>${p.dias_inoperante} dia(s) parada</b>.</p>` : ""}`;
    }
    if (h.layer.id === "comportas-pt") html = `<h4>Comporta ${GG.esc(p.comporta)}</h4><p>${p.falhou_2024 === true || p.falhou_2024 === "true" ? `<b style="color:var(--crit)">Falhou em maio de 2024</b>` : "Sem falha registrada em 2024"}</p>`;
    if (h.layer.id === "abrigos-pt") html = `<h4>${GG.esc(p.nome)}</h4><p>${GG.esc(p.tipo)}</p><p class="mut">${GG.esc(p.endereco || "")}</p><p>Aceitava pets: <b>${GG.esc(p.pets || "não informado")}</b></p><p class="mut">Foi abrigo em maio de 2024. Confirme no 199 se está aberto.</p>`;
    if (h.layer.id === "marcas-pt") html = `<h4>Marca de cheia · ${GG.esc(p.local)}</h4><p>Nível da água medido: <b class="mono">${GG.esc(p.nivel_m)} m</b> em ${GG.esc(p.data)}</p><p class="mut peq">Medição de campo, ${GG.esc(p.grupo)}.</p>`;
    popup.setLngLat(e.lngLat).setHTML(`<div class="pop">${html}</div>`).addTo(map);
  }

  function escolherPonto(msg = "Toque no mapa no local exato") {
    return new Promise((ok) => {
      GG.ir("mapa");
      GG.$("#mira div").textContent = msg;
      GG.$("#mira").hidden = false;
      escolhendo = ok;
    });
  }
  function marcarCasa(lon, lat) {
    if (!map) { marcarCasa.pendente = [lon, lat]; return; }
    if (!marcarCasa.m) {
      const d = document.createElement("div");
      d.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" aria-label="Minha casa"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" fill="#1565c0" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
      marcarCasa.m = new maplibregl.Marker({ element: d });
    }
    marcarCasa.m.setLngLat([lon, lat]).addTo(map);
  }

  return { iniciar, escolherPonto, marcarCasa, resize: () => map?.resize(), abrirRelato, filtro, get map() { return map; } };
})();
