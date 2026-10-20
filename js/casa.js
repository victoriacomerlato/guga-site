/* GuGa · Minha casa: em que altura do Guaíba a rua alaga, quanta água entra e quando.
   Uma resposta grande com o desenho da casa; o resto embaixo, curto. */
GG.casa = (() => {
  let alvo = null, analise = null;
  // cheias para comparar (régua do Cais Mauá). Prefeitura de POA e Jornal do Comércio; 2024: régua (SGB estimou 5,37 m pelas marcas).
  const EVENTOS = [
    { cm: 535, rot: "Maio de 2024" }, { cm: 475, rot: "Maio de 1941" }, { cm: 346, rot: "Novembro de 2023" }, { cm: 294, rot: "Outubro de 2015" },
  ];

  function profundidade(nivelCm, faixa) {
    if (!faixa) return null;
    const pv = Math.max(faixa.prev || 0, 100);
    const min = Math.max(0, nivelCm - faixa.cm), max = Math.max(0, nivelCm - pv), mid = Math.max(0, nivelCm - (pv + faixa.cm) / 2);
    return { min, max, mid };
  }
  // mesmos limites dos marcos (MARCOS): rua, porta 20 cm, joelho 50, janela 100, teto 260
  function descrever(cm) {
    if (cm <= 0) return { t: "Sem água na rua", cls: "ok" };
    if (cm < 20) return { t: "Água na rua e na calçada", cls: "warn" };
    if (cm < 50) return { t: "Água entra pela porta", cls: "alert" };
    if (cm < 100) return { t: "Água acima do joelho dentro de casa", cls: "crit" };
    if (cm < 260) return { t: "Água na altura da janela", cls: "crit" };
    return { t: "Água perto do teto", cls: "crit" };
  }
  const horas = (h) => !isFinite(h) ? "—" : h < 1 ? `${Math.max(10, Math.round(h * 60 / 10) * 10)} minutos` : h < 48 ? `${Math.round(h)} horas` : `${GG.fmt(h / 24, 0)} dias`;

  // marcos que a pessoa entende: altura da água no chão da rua (cm)
  const MARCOS = [
    { cm: 1, t: "Água na rua", curto: "Na rua", ic: "ondas" },
    { cm: 20, t: "Entra pela porta", curto: "Na porta", ic: "casa" },
    { cm: 50, t: "Acima do joelho", curto: "No joelho", ic: "bota" },
    { cm: 100, t: "Na altura da janela", curto: "Na janela", ic: "janela" },
    { cm: 260, t: "Perto do teto", curto: "No teto", ic: "alerta" },
  ];
  const RITMO_2024 = 4.8;  // cm por hora: subida do Guaíba entre 2 e 3 de maio de 2024 (aproximado)
  const HORIZONTE = 72;    // horas
  let ritmoModo = "agora", horaSel = 0, tocando = null;

  /** Quando cada marco acontece, dado o nível atual e um ritmo (cm/h). h=0 → já; Infinity → não chega. */
  function previsao(f, atual, ritmo) {
    const pv = Math.max(f.prev || 0, 100), meio = (pv + f.cm) / 2;
    return MARCOS.map((m) => {
      const alvoMeio = meio + m.cm, cedo = pv + m.cm, tarde = f.cm + m.cm;
      const h = (n) => n <= atual ? 0 : ritmo > 0.3 ? (n - atual) / ritmo : Infinity;
      return { ...m, h: h(alvoMeio), min: h(cedo), max: h(tarde) };
    });
  }
  const curta = (h) => !isFinite(h) || h > HORIZONTE ? "3 dias ou mais" : h < 1 ? "menos de 1 h" : h < 48 ? `${Math.round(h)} h` : `${GG.fmt(h / 24, 0)} dias`;
  const quando = (h) => h === 0 ? "já" : !isFinite(h) || h > HORIZONTE ? "não em 3 dias" : `em ${horas(h)}`;

  /** desenho da casa com a água. mini = sem a régua da direita (para o cartão da tela Hoje e a imagem). */
  function svgCasa(prof, mini = false) {
    const esc = 50, chao = 262, W = 440, VW = mini ? 340 : W;
    const y = (m) => chao - m * esc;
    const dMid = prof ? Math.max(0, prof.mid) / 100 : 0, dMax = prof ? prof.max / 100 : 0;
    const topo = (d) => y(Math.min(d, 5.2));
    const onda = (d) => `M0 ${topo(d)} q 27.5 -7 55 0 t 55 0 t 55 0 t 55 0 t 55 0 t 55 0 t 55 0 t 55 0 V 300 H 0 Z`;
    const regua = mini ? "" : [[0.5, "joelho"], [1.0, "janela"], [2.8, "teto"]]
      .map(([m, t]) => `<line x1="350" x2="364" y1="${y(m)}" y2="${y(m)}" stroke="#232421" stroke-width="2.5"/><text x="370" y="${y(m) + 6}" fill="#232421" font-size="18" font-weight="700" font-family="Atkinson Hyperlegible, Verdana, sans-serif">${t}</text>`).join("");
    return `<svg viewBox="0 0 ${VW} 300" role="img" aria-label="Casa com a altura estimada da água" style="width:100%;display:block">
      <defs><pattern id="hach${mini ? "m" : ""}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#2a7bbd" opacity=".18"/><line x1="0" y1="0" x2="0" y2="8" stroke="#2a7bbd" stroke-width="3" opacity=".4"/></pattern></defs>
      <rect width="${VW}" height="300" fill="#e9eae5"/>
      <g stroke="#232421" stroke-width="3" stroke-linejoin="miter">
        <path d="M40 ${y(0)} V ${y(2.8)} H 300 V ${y(0)}" fill="#f2f2ee"/>
        <path d="M24 ${y(2.8)} L 170 ${y(4.5)} L 316 ${y(2.8)} Z" fill="#c4b28a"/>
        <rect x="72" y="${y(2.1)}" width="56" height="${2.1 * esc}" fill="#dcddd8"/>
        <rect x="184" y="${y(2.2)}" width="84" height="${1.2 * esc}" fill="#dcddd8"/>
        <path d="M226 ${y(2.2)} V ${y(1.0)} M184 ${y(1.6)} H 268" stroke-width="2"/>
      </g>
      <g fill="#232421"><circle cx="152" cy="${y(1.6)}" r="9"/><path d="M143 ${y(1.45)} h18 l2 ${0.72 * esc} h-22 z"/><rect x="144.5" y="${y(0.75)}" width="6" height="${0.75 * esc}" rx="2"/><rect x="153.5" y="${y(0.75)}" width="6" height="${0.75 * esc}" rx="2"/></g>
      ${dMax > dMid ? `<rect x="0" y="${topo(dMax)}" width="340" height="${(Math.min(dMax, 5.2) - dMid) * esc}" fill="url(#hach${mini ? "m" : ""})"/>` : ""}
      ${dMid > 0 ? `<path d="${onda(dMid)}" fill="#2a7bbd" opacity=".82" transform="scale(${340 / W} 1)"/>` : ""}
      <rect x="0" y="${chao}" width="${VW}" height="${300 - chao}" fill="#232421"/>
      ${regua}
    </svg>`;
  }

  /** A faixa do mapa diz só que o chão está entre prev e cm. Se o Guaíba de agora está dentro dessa faixa e a rua
      ainda está seca, o chão está acima do nível de agora: estreita a faixa por baixo. */
  const faixaEfetiva = (f, atual) => ({ ...f, prev: Math.max(Math.max(f.prev || 0, 100), Math.min(atual ?? 0, f.cm - 1)) });

  /** Resumo da casa salva para a tela Hoje, a voz e a imagem de alerta. Nunca assusta à toa:
      com o rio parado diz "seca agora" e mostra o cenário de 2024 só como "se subir". */
  function resumo(e) {
    const c = salvaFn();
    if (!c || !e) return null;
    if (!c.faixa) {
      const fora = c.dentroPOA === false;
      return { manchete: fora ? "Sem previsão aqui" : "Não alaga pelo rio", frase: fora ? "ainda sem previsão para este lugar" : "a água do Guaíba não chega aqui",
        subCurta: fora ? "Calculamos a altura da água só em Porto Alegre." : "Chuva forte ainda pode alagar por bueiro entupido.", prof: null, urgente: false, ritmoTxt: "" };
    }
    const fx = faixaEfetiva(c.faixa, e.cm), sobe = !!(e.t && e.t.cmh > 0.3), ritmo = sobe ? e.t.cmh : RITMO_2024;
    const pv = previsao(fx, e.cm, ritmo);
    const prox = pv.find((m) => m.h > 0 && m.h <= HORIZONTE), ja = [...pv].reverse().find((m) => m.h === 0);
    let manchete, frase, subCurta, N = e.cm, urgente = false;
    if (ja) {
      manchete = `${ja.t} agora`; frase = `${ja.t.toLowerCase()} agora`; urgente = true;
      subCurta = sobe && prox ? `Depois: ${prox.curto.toLowerCase()} em ${horas(prox.h)}.` : "Siga o passo a passo de O que fazer.";
    } else if (sobe && prox) {
      manchete = `${prox.curto} em ${horas(prox.h)}`; frase = `água ${prox.curto.toLowerCase()} em cerca de ${horas(prox.h)}`;
      subCurta = "No ritmo de agora. Toque para ver hora a hora."; N = e.cm + ritmo * prox.h; urgente = prox.h < 24;
    } else if (sobe) {
      manchete = "Sem água em 3 dias"; frase = "sem água prevista nos próximos 3 dias"; subCurta = "No ritmo de agora.";
    } else {
      manchete = "Seca agora"; frase = "seca agora, o rio não está subindo";
      subCurta = prox ? `Se subir como em 2024: ${prox.curto.toLowerCase()} em ${horas(prox.h)}.` : "Sem água em 3 dias, mesmo no ritmo de 2024.";
    }
    return { manchete, frase, subCurta, prof: profundidade(N, fx), urgente, sobe, prox, ja,
      ritmoTxt: sobe ? `Previsão no ritmo de agora (${GG.fmt(ritmo, 1)} cm por hora). Muda se a chuva aumentar.` : "O rio não está subindo agora." };
  }

  function painelPrevisao(f, atual, nv) {
    const t = nv ? GG.live.tendencia(nv.serie, 6) || GG.live.tendencia(nv.serie, 24) : null;
    const sobeAgora = t && t.cmh > 0.3;
    if (!sobeAgora && ritmoModo === "agora") ritmoModo = "2024";
    const ritmo = ritmoModo === "agora" ? t.cmh : RITMO_2024;
    const pv = previsao(f, atual, ritmo);
    const prox = pv.find((m) => m.h > 0 && m.h <= HORIZONTE);
    const jaAgora = [...pv].reverse().find((m) => m.h === 0);
    const manchete = prox ? `${prox.curto} em ${horas(prox.h)}` : jaAgora ? `${jaAgora.t} agora` : "A água não chega em 3 dias";
    const urg = !!(jaAgora || (prox && prox.h < 24 && ritmoModo === "agora"));
    const cenario = ritmoModo === "agora" ? `No ritmo de agora: ${GG.fmt(ritmo, 1)} cm por hora` : sobeAgora ? `Se subir como em maio de 2024 (${GG.fmt(ritmo, 1)} cm por hora)` : `O rio está parado. Se subir como em maio de 2024:`;
    return `<section class="previsao ${urg ? "urgente" : ""}" aria-labelledby="prev-t">
      <span class="faixa"><span>Quando a água chega</span></span>
      <p class="cenario">${cenario}</p>
      <h3 class="manchete" id="prev-t">${manchete}</h3>
      <div class="modos" role="group" aria-label="Ritmo da subida">
        <button data-ritmo="agora" aria-pressed="${ritmoModo === "agora"}" ${sobeAgora ? "" : "disabled"}>Agora</button>
        <button data-ritmo="2024" aria-pressed="${ritmoModo === "2024"}">Como em 2024</button>
      </div>
      <div class="casa-tela"><div id="casa-svg"></div><p class="leitura-h" id="prev-leitura" aria-live="polite"></p></div>
      <div class="tempo">
        <input type="range" id="prev-h" min="0" max="${HORIZONTE}" step="1" value="${horaSel}" aria-label="Daqui a quantas horas">
        <div class="marcas-h" aria-hidden="true">${[[0, "Agora"], [24, "1 dia"], [48, "2 dias"], [72, "3 dias"]].map(([h, r]) => `<span style="left:${(h / HORIZONTE) * 100}%">${r}</span>`).join("")}</div>
        <button class="btn primario" id="prev-play">▶ Ver a água subir</button>
      </div>
      <ol class="marcos">${pv.map((m, i) => `<li data-i="${i}" class="${m.h === 0 ? "ja" : ""}"><span class="mi">${GG.ic(m.ic, 24)}</span><b>${m.t}</b><span>${quando(m.h)}${m.h > 0 && isFinite(m.h) && m.h <= HORIZONTE && m.max - m.min > 2 ? `<small>de ${curta(m.min)} a ${curta(m.max)}</small>` : ""}</span></li>`).join("")}</ol>
    </section>`;
  }

  function ligarPrevisao(f, atual, nv) {
    const t = nv ? GG.live.tendencia(nv.serie, 6) || GG.live.tendencia(nv.serie, 24) : null;
    const ritmo = () => ritmoModo === "agora" && t ? t.cmh : RITMO_2024;
    const R = GG.$("#prev-h");
    const pintar = () => {
      horaSel = +R.value;
      const N = Math.min(700, atual + ritmo() * horaSel), p = profundidade(N, f), d = descrever(p.mid);
      GG.$("#casa-svg").innerHTML = svgCasa(p);
      GG.$("#prev-leitura").innerHTML = `<b>${horaSel === 0 ? "Agora" : `Daqui a ${horas(horaSel)}`}</b><span>Guaíba em ${GG.m(N)}</span><span class="d ${p.mid > 0 ? d.cls : p.max > 0 ? "warn" : "ok"}">${p.max <= 0 ? "Sem água na rua" : p.mid <= 0 ? `Pode chegar água na rua: até ${GG.fmt(p.max)} cm` : `${d.t}: ${GG.fmt(p.min)} a ${GG.fmt(p.max)} cm`}</span>`;
      R.style.setProperty("--p", (horaSel / HORIZONTE) * 100 + "%");
      const pv = previsao(f, atual, ritmo());
      GG.$$(".marcos li").forEach((li) => li.classList.toggle("on", pv[+li.dataset.i].h <= horaSel && pv[+li.dataset.i].h > 0));
    };
    R.addEventListener("input", () => { parar(); pintar(); });
    GG.$$("[data-ritmo]").forEach((b) => b.onclick = () => { ritmoModo = b.dataset.ritmo; parar(); render(); });
    GG.$("#prev-play").onclick = () => {
      if (tocando) return parar();
      if (+R.value >= HORIZONTE) R.value = 0;
      GG.$("#prev-play").textContent = "❚❚ Pausar";
      let last = performance.now();
      const passo = (now) => {
        R.value = Math.min(HORIZONTE, +R.value + (now - last) / 1000 * 7); last = now; pintar();
        tocando = +R.value < HORIZONTE ? requestAnimationFrame(passo) : (parar(), null);
      };
      tocando = requestAnimationFrame(passo);
    };
    pintar();
  }
  function parar() { if (tocando) cancelAnimationFrame(tocando); tocando = null; const b = GG.$("#prev-play"); if (b) b.textContent = "▶ Ver a água subir"; }

  function render() {
    const el = GG.$("#casa-resultado");
    if (!alvo) { el.innerHTML = ""; return; }
    parar();
    const a = analise, nv = GG.live.nivel;
    const atual = nv?.serie?.at(-1)?.cm ?? null;
    const treino = nv?.simulado ? `<p class="nota">${GG.ic("alerta", 18)} O nível do Guaíba aqui é de treino. No app publicado vem da ANA, ao vivo.</p>` : "";
    const enviar = `<div class="enviar-mini"><button class="enviar-txt" data-compartilhar><span class="ic">${GG.ic("compartilhar", 22)}</span><span>Mandar para a família<small>Vai só o bairro, não o endereço</small></span></button>
      <button class="redondo zap" data-enviar="whatsapp" aria-label="Mandar no WhatsApp">${GG.ic("whatsapp", 22)}</button><button class="redondo insta" data-enviar="instagram" aria-label="Mandar no Instagram">${GG.ic("instagram", 20)}</button></div>`;
    let html = "";

    if (a.dentroPOA && a.faixa) {
      const f = a.faixa, fx = faixaEfetiva(f, atual), inicio = Math.max(f.prev || 0, 100), molhada = atual != null && atual >= inicio;
      html = `
        ${atual != null ? painelPrevisao(fx, atual, nv) : ""}
        <div class="cota-linha ${molhada ? "crit" : ""}"><span class="ic">${GG.ic("regua", 28)}</span>
          <span><b>${f.baixa ? `Sua rua alaga com o Guaíba acima de ${GG.m(f.cm)}` : `A água chega aqui com o Guaíba a partir de ${GG.m(inicio)}`}</b>
          ${atual != null ? `<br><span class="mut">Agora: ${GG.m(atual)}.</span>` : ""}
          ${a.polder ? `<br><span class="mut">Área com dique: só alaga se o sistema falhar, como em 2024.</span>` : ""}</span></div>
        ${treino}${enviar}
        <div class="card"><h3>Já alagou aqui?</h3>
          <div class="historico-cheias">${EVENTOS.map((ev) => { const p = profundidade(ev.cm, f); return `<div><span>${ev.rot}<small>Guaíba em ${GG.m(ev.cm)}</small></span>${p.max <= 0 ? `<b class="nao">${GG.ic("check", 20)}Não</b>` : `<b class="sim-h">${GG.ic("ondas", 20)}Sim, até ${GG.m(p.max, 1)}</b>`}</div>`; }).join("")}</div></div>`;
    } else if (a.dentroPOA && a.foraDeTodas) {
      html = `<div class="cota-linha ok"><span class="ic">${GG.ic("check", 28)}</span><span><b>A água do Guaíba não chega aqui</b><br><span class="mut">Nem com o lago a 7 metros. Chuva forte ainda pode alagar a rua por bueiro entupido ou enxurrada do morro.</span></span></div>
        <div class="linha"><button class="btn" data-relatar="bueiro">${GG.ic("bueiro", 24)}Avisar bueiro entupido</button><a class="btn" href="#morro" data-nav="morro">${GG.ic("morro", 24)}Enxurrada do morro</a></div>${enviar}`;
    } else if (a.mancha) {
      const m = a.mancha;
      html = `<div class="veredito ${m.dentro ? "crit" : m.dist < 300 ? "alert" : "ok"}">
        <p class="grande">${m.dentro ? "Este lugar alagou em maio de 2024" : m.dist < 300 ? `Não alagou em 2024, mas a água ficou a ${GG.fmt(m.dist)} m` : "Não alagou em maio de 2024"}</p>
        <p>Pelas fotos de satélite de 6 e 8 de maio de 2024. Fora de Porto Alegre ainda não calculamos a altura da água.</p></div>`;
    } else {
      html = `<div class="veredito"><p class="grande">Ainda não temos dados deste lugar</p><p>O GuGa cobre a bacia do Guaíba: Porto Alegre, Canoas, São Leopoldo, Vale do Taquari, Caí, Sinos e Gravataí.</p></div>`;
    }
    el.innerHTML = html + `<div class="card" id="casa-abrigos"><h3>Para onde ir</h3><p class="mut">Procurando lugares mais altos…</p></div><div id="casa-chuva"></div>
      <details><summary>Como calculamos</summary><p class="mut" style="margin-top:6px">Comparamos o endereço com as manchas de inundação do IPH/UFRGS para cada altura do Guaíba (régua do Cais Mauá). O mapa diz em que faixa de altura o terreno está, não a altura exata: por isso mostramos uma faixa (de tanto a tanto) e a parte riscada no desenho. Não vê muros, aterros nem degraus. O tempo usa o ritmo de subida do Guaíba nas últimas horas (ANA) e muda se a chuva aumentar. O ritmo de 2024 (${GG.fmt(RITMO_2024, 1)} cm por hora) é a subida aproximada entre 2 e 3 de maio de 2024.</p></details>`;
    if (a.dentroPOA && a.faixa && atual != null) ligarPrevisao(faixaEfetiva(a.faixa, atual), atual, nv);
    abrigos();
    chuva();
  }

  async function abrigos() {
    const box = GG.$("#casa-abrigos");
    try {
      const lista = await GG.data.abrigosProximos(alvo.lon, alvo.lat, 3, analise.faixa?.cm ?? null);
      GG.casa.abrigosSugeridos = lista;
      box.innerHTML = `<h3>Para onde ir</h3>
        ${lista.length ? `<div class="opcoes" style="grid-template-columns:1fr">${lista.map((a) => `<div class="opcao" style="cursor:default"><span class="ic">${GG.ic("abrigo", 24)}</span><span>${GG.esc(a.nome)}<small>${GG.fmt(a.dist / 1000, 1)} km daqui${a.endereco ? ` · ${GG.esc(a.endereco)}` : ""}</small></span></div>`).join("")}</div>` : `<p>Nenhum abrigo mais alto por perto. Ligue 199.</p>`}
        <p class="nota">Foram abrigos em 2024. Antes de ir, confirme no <b>199</b> se estão abertos.</p>
        <button class="btn" id="ver-mapa-casa">${GG.ic("mapa", 24)}Ver no mapa</button>`;
      GG.$("#ver-mapa-casa").onclick = () => { GG.ir("mapa"); setTimeout(() => GG.mapa.map?.flyTo({ center: [alvo.lon, alvo.lat], zoom: 15 }), 300); };
    } catch { box.innerHTML = `<h3>Para onde ir</h3><p>Ligue 199 (Defesa Civil).</p>`; }
  }
  async function chuva() {
    const box = GG.$("#casa-chuva");
    try {
      const c = await GG.live.chuva(alvo.lat, alvo.lon);
      box.innerHTML = `<div class="tempo-hoje" style="grid-template-columns:1fr 1fr"><div class="t ${c.prox24 > 50 ? "aviso" : ""}">${GG.ic("chuva", 32)}<b>${GG.fmt(c.prox24)} mm</b><small>chuva aqui em 24 h</small></div><div class="t">${GG.ic("chuva", 32)}<b>${GG.fmt(c.prox72)} mm</b><small>em 3 dias</small></div></div>`;
    } catch { box.innerHTML = ""; }
  }

  async function definir(lon, lat, rotulo, rolar = true, precisao = null) {
    alvo = { lon, lat, rotulo, ...(precisao ? { precisao } : {}) };
    GG.$("#casa-resultado").innerHTML = `<p class="mut">Calculando…</p>`;
    analise = await GG.data.analisar(lon, lat);
    const salva = salvaFn(), ehSalva = salva && Math.abs(salva.lon - lon) < 1e-6 && Math.abs(salva.lat - lat) < 1e-6;
    GG.$("#casa-busca").hidden = !!ehSalva;
    GG.$("#casa-sub").textContent = ehSalva ? "Hora a hora, até onde a água pode subir." : "Quando a água chega e até onde sobe.";
    const prec = precisao || (ehSalva ? salva.precisao : null);
    GG.$("#casa-local").innerHTML = `<div class="local-casa"><span>${GG.ic("alfinete", 28)}<span><b>${GG.esc(rotulo)}</b>${analise.bairro || prec ? `<small>${[analise.bairro, prec].filter(Boolean).map(GG.esc).join(" · ")}</small>` : ""}</span></span>
      ${ehSalva ? `<button class="btn leve" id="casa-trocar">Trocar</button>` : `<button class="btn primario" id="casa-salvar">Salvar</button>`}</div>`;
    GG.$("#casa-trocar")?.addEventListener("click", () => { GG.$("#casa-busca").hidden = false; GG.$("#casa-q").focus(); });
    GG.$("#casa-salvar")?.addEventListener("click", () => { GG.store.set("casa", { ...alvo, bairro: analise.bairro, faixa: analise.faixa, polder: !!analise.polder, dentroPOA: analise.dentroPOA }); GG.toast("Salvo neste celular. Não é enviado a ninguém."); GG.emit("casa", salvaFn()); definir(lon, lat, rotulo, false, alvo.precisao); });
    GG.mapa.marcarCasa(lon, lat);
    render();
    if (rolar) GG.$("#casa-local").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function falar() {
    const t = [];
    if (!alvo) return "Digite o endereço da sua casa para saber se a água chega.";
    t.push(`Endereço: ${alvo.rotulo}.`);
    const man = GG.$("#prev-t")?.textContent, cen = GG.$(".previsao .cenario")?.textContent;
    if (man) t.push(`${cen || ""} ${man}.`);
    GG.$$(".marcos li").forEach((li) => t.push(`${li.querySelector("b").textContent}: ${li.querySelector("span:last-child").childNodes[0]?.textContent || ""}.`));
    const cota = GG.$(".cota-linha b")?.textContent; if (cota) t.push(cota + ".");
    return t;
  }

  function iniciar() {
    const precisaoTxt = (p) => p.tipo === "exato" ? "Endereço do IBGE" : p.tipo === "entre" ? `Aproximado, entre o nº ${p.de} e o ${p.ate}` : p.tipo === "perto" ? `Aproximado, perto do nº ${p.de}` : "Meio da rua (número não encontrado)";
    const escolheu = (p) => { GG.$("#casa-opcoes").innerHTML = ""; GG.$("#casa-q").blur(); definir(p.lon, p.lat, p.rotulo, true, precisaoTxt(p)); };
    const auto = GG.busca.ligar(GG.$("#casa-q"), GG.$("#casa-sug"), escolheu);
    document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".busca-campo")) GG.$("#casa-sug").hidden = true; });
    GG.$("#casa-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = GG.$("#casa-q").value.trim();
      if (!q) return;
      const out = GG.$("#casa-opcoes");
      // 1º: índice do IBGE no próprio aparelho (rua + número)
      const melhor = await auto.primeiro().catch(() => null);
      if (melhor) {
        GG.$("#casa-sug").hidden = true;
        if (!melhor.num) { GG.$("#casa-q").value = melhor.rua.nome + ", "; GG.$("#casa-q").focus(); GG.toast("Agora digite o número da casa."); return; }
        const p = await GG.busca.localizar(melhor.rua, melhor.num);
        GG.$("#casa-q").value = `${melhor.rua.nome}, ${melhor.num}`;
        return escolheu({ ...p, rotulo: `${melhor.rua.nome}, ${melhor.num}` });
      }
      // 2º: busca geral (OpenStreetMap), para o que não está no índice
      out.innerHTML = `<p class="mut">Buscando…</p>`;
      try {
        const r = await GG.live.geocodificar(q.match(/,|rs|porto alegre/i) ? q : q + ", Rio Grande do Sul");
        if (!r.length) { out.innerHTML = `<p>Não achei esse endereço. Tente rua e número.</p>`; return; }
        out.innerHTML = `<p class="mut">Qual destes?</p>` + r.map((x, i) => `<button class="opcao" data-i="${i}"><span class="ic">${GG.ic("alfinete", 22)}</span><span>${GG.esc(x.nome.split(",").slice(0, 4).join(","))}</span></button>`).join("");
        GG.$$("#casa-opcoes .opcao").forEach((b) => b.onclick = () => { const x = r[+b.dataset.i]; out.innerHTML = ""; definir(x.lon, x.lat, x.nome.split(",").slice(0, 2).join(",")); });
      } catch {
        out.innerHTML = `<p class="nota">A busca por endereço não está funcionando agora. Escolha o bairro ou marque no mapa.</p>`;
      }
    });
    GG.$("#casa-mapa").onclick = async () => { const p = await GG.mapa.escolherPonto("Toque onde fica a sua casa"); GG.ir("casa"); definir(p.lon, p.lat, "Ponto marcado no mapa"); };
    GG.$("#casa-gps").onclick = () => {
      if (!navigator.geolocation) return GG.toast("Este celular não informa a localização.", "erro");
      navigator.geolocation.getCurrentPosition((p) => definir(p.coords.longitude, p.coords.latitude, "Onde estou agora"),
        () => GG.toast("Sem permissão de localização. Use o endereço ou marque no mapa.", "erro"), { enableHighAccuracy: true, timeout: 10000 });
    };
    GG.data.load("bairros").then((b) => {
      const s = GG.$("#casa-bairro");
      s.innerHTML = `<option value="">Escolha o bairro (Porto Alegre)</option>` + b.features.map((f) => f.properties.bairro).sort((x, y) => x.localeCompare(y, "pt-BR")).map((n) => `<option>${GG.esc(n)}</option>`).join("");
      s.onchange = () => {
        const f = b.features.find((x) => x.properties.bairro === s.value);
        if (!f) return;
        const c = centro(f.geometry);
        definir(c[0], c[1], `Bairro ${s.value}`);
      };
    }).catch(() => {});
    GG.on("nivel", () => alvo && !GG.$("#v-casa").hidden && render());
    GG.voz.resumo("casa", falar);
    const salva = salvaFn();
    if (salva) definir(salva.lon, salva.lat, salva.rotulo || "Minha casa", false);
    else definir(-51.2216, -30.0405, "Exemplo: Cidade Baixa", false);
  }
  function centro(g) {
    const ring = (g.type === "Polygon" ? g.coordinates : [...g.coordinates].sort((a, b) => b[0].length - a[0].length)[0])[0];
    let x = 0, y = 0; ring.forEach((p) => { x += p[0]; y += p[1]; });
    const c = [x / ring.length, y / ring.length];
    return GG.data.contem({ features: [{ geometry: g, bbox: [-180, -90, 180, 90] }] }, c).length ? c : ring[0];
  }
  const salvaFn = () => GG.store.get("casa", null);

  return { iniciar, definir, previsao, faixaEfetiva, horas, resumo, svgCasa, RITMO_2024, salva: salvaFn, get alvo() { return alvo; }, get analise() { return analise; }, abrigosSugeridos: [] };
})();
