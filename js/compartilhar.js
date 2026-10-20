/* GuGa · encaminhar o alerta. Monta uma imagem bem legível (nível do Guaíba, estado, a casa da pessoa com a água,
   o que fazer, fonte e horário) e manda pelo WhatsApp ou pelo Instagram usando o "Compartilhar" do próprio celular.
   Nível de treino nunca sai como se fosse real: a imagem leva a faixa "SIMULAÇÃO". Endereço não sai: só o bairro. */
GG.compartilhar = (() => {
  const W = 1080, H = 1350;
  const COR = GG.COR_ESTADO;
  const FONTE_D = '"Barlow Condensed", "Arial Narrow", sans-serif', FONTE_B = '"Atkinson Hyperlegible", Verdana, sans-serif';
  let ultimoBlob = null;

  const hora = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(" ", " às ");
  const url = () => GG.CONFIG.urlPublica || location.href.split("#")[0];

  /** dados do alerta, os mesmos para a imagem e para o texto */
  function dados() {
    const nv = GG.live.nivel, e = GG.estadoGuaiba(nv);
    const casa = GG.casa.salva(), rc = e ? GG.casa.resumo(e) : null;
    return { e, nv, casa, rc, quando: nv?.serie?.length ? hora(nv.serie.at(-1).t) : "" };
  }

  /** mensagem curta para WhatsApp: ícones no começo de cada linha, uma ideia por linha */
  function mensagem() {
    const { e, casa, rc, quando } = dados();
    const L = [];
    if (e) {
      const bola = { normal: "🟢", atencao: "🟡", alerta: "🟠", inundacao: "🔴" }[e.nivel];
      L.push(`🌊 *Guaíba: ${GG.m(e.cm)}* ${e.sobe ? `e subindo (${GG.fmt(e.t.cmh, 0)} cm por hora)` : e.desce ? "e baixando" : "e parado"}`);
      L.push(`${bola} *${e.rot.toUpperCase()}*: ${GG.FRASE_ESTADO[e.nivel]}`);
      if (e.simulado) L.push("⚠️ _Simulação de treino, não é o nível real._");
    }
    if (casa && rc) L.push(`🏠 Na minha casa${casa.bairro ? ` (${casa.bairro})` : ""}: ${rc.frase}.`);
    L.push("🎒 Separe documentos, remédios e carregador.");
    L.push("📞 Defesa Civil *199* · Bombeiros *193*");
    L.push(`👉 Veja a sua rua no GuGa: ${url()}`);
    if (e && !e.simulado) L.push(`_Fonte: ANA, régua do Cais Mauá, ${quando}_`);
    return L.join("\n");
  }

  // ── imagem ─────────────────────────────────────────────
  const carregar = (svg) => new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img); img.onerror = erro;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  const svgIcone = (nome, cor, tam = 64) => GG.ic(nome, tam).replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" `).replaceAll("currentColor", cor);
  function caixa(c, x, y, w, h, r, cor) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = cor; c.fill(); }
  function quebrar(c, txt, x, y, larg, alt) {
    const ps = txt.split(" "); let l = "", n = 0;
    for (const p of ps) { const t = l ? l + " " + p : p; if (c.measureText(t).width > larg && l) { c.fillText(l, x, y + n * alt); l = p; n++; } else l = t; }
    c.fillText(l, x, y + n * alt); return n + 1;
  }

  async function gerar() {
    const { e, casa, rc, quando } = dados();
    await Promise.all([`italic 700 200px ${FONTE_D}`, `700 40px ${FONTE_B}`, `400 34px ${FONTE_B}`].map((f) => document.fonts?.load(f).catch(() => null)));
    const cv = Object.assign(document.createElement("canvas"), { width: W, height: H }), c = cv.getContext("2d");
    const nivel = e?.nivel || "normal", cor = COR[nivel], tCor = nivel === "atencao" ? "#14202b" : "#ffffff";
    c.fillStyle = "#f3f6f9"; c.fillRect(0, 0, W, H);

    // faixa de cima: marca e horário
    caixa(c, 0, 0, W, 470, 0, cor);
    const logo = GG.$(".marca svg")?.outerHTML;
    if (logo) { try { c.drawImage(await carregar(logo.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" `)), 60, 46, 96, 96); } catch { /* sem logo */ } }
    c.fillStyle = tCor; c.textBaseline = "alphabetic";
    c.font = `italic 700 66px ${FONTE_D}`; c.fillText("GuGa", 172, 104);
    c.font = `400 30px ${FONTE_B}`; c.globalAlpha = .9; c.fillText("Guardião Gaúcho", 174, 140); c.globalAlpha = 1;
    c.textAlign = "right"; c.font = `700 32px ${FONTE_B}`; c.fillText(quando, W - 60, 104);
    c.font = `400 28px ${FONTE_B}`; c.fillText(e?.simulado ? "treino" : "ao vivo", W - 60, 140); c.textAlign = "left";

    // nível
    c.font = `700 34px ${FONTE_B}`; c.fillText("GUAÍBA EM PORTO ALEGRE", 60, 236);
    c.font = `italic 700 210px ${FONTE_D}`;
    const num = e ? GG.m(e.cm) : "—"; c.fillText(num, 52, 420);
    const wn = c.measureText(num).width;
    if (e && (e.sobe || e.desce)) {
      try { c.drawImage(await carregar(svgIcone(e.sobe ? "setaCima" : "setaBaixo", tCor, 110)), 52 + wn + 24, 300, 110, 110); } catch { /* */ }
    }
    c.font = `700 40px ${FONTE_B}`;
    c.fillText(e ? (e.sobe ? `subindo ${GG.fmt(e.t.cmh, 0)} cm/h` : e.desce ? "baixando" : "parado") : "", 52 + wn + 150, 380);

    // estado
    let y = 520;
    caixa(c, 60, y, W - 120, 150, 28, "#ffffff");
    caixa(c, 60, y, 22, 150, [28, 0, 0, 28], cor);
    c.fillStyle = nivel === "atencao" ? "#8a6500" : cor; c.font = `italic 700 74px ${FONTE_D}`;
    c.fillText((e?.rot || "Sem leitura").toUpperCase(), 116, y + 78);
    c.fillStyle = "#14202b"; c.font = `400 34px ${FONTE_B}`;
    c.fillText(e ? GG.FRASE_ESTADO[nivel] : "Acompanhe a Defesa Civil: 199.", 116, y + 124);

    // minha casa (só o bairro) ou o que fazer
    y = 700;
    caixa(c, 60, y, W - 120, 420, 28, "#ffffff");
    if (casa && rc && GG.casa.svgCasa) {
      try {
        const svg = GG.casa.svgCasa(rc.prof).replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="300" `).replace('style="width:100%;display:block"', "");
        c.save(); c.beginPath(); c.roundRect(84, y + 24, 440, 300, 18); c.clip(); c.drawImage(await carregar(svg), 84, y + 24, 440, 300); c.restore();
      } catch { /* sem desenho */ }
      c.fillStyle = "#566573"; c.font = `700 30px ${FONTE_B}`; c.fillText("NA MINHA CASA", 556, y + 74);
      if (casa.bairro) { c.font = `400 30px ${FONTE_B}`; c.fillText(casa.bairro, 556, y + 114); }
      c.fillStyle = rc.urgente ? COR.inundacao : "#14202b"; c.font = `italic 700 66px ${FONTE_D}`;
      quebrar(c, rc.manchete.toUpperCase(), 556, y + 190, W - 120 - 520, 64);
      c.fillStyle = "#566573"; c.font = `400 26px ${FONTE_B}`;
      quebrar(c, rc.ritmoTxt, 84, y + 370, W - 220, 32);
    } else {
      const itens = [["mochila", "Separe documentos, remédios e carregador"], ["familia", "Combine com a família onde se encontrar"], ["casa", "Veja no GuGa se a sua rua alaga"]];
      for (const [k, [ic, t]] of itens.entries()) {
        const yy = y + 40 + k * 124;
        caixa(c, 90, yy, 96, 96, 48, "#e3f0fc");
        try { c.drawImage(await carregar(svgIcone(ic, "#1565c0", 60)), 108, yy + 18, 60, 60); } catch { /* */ }
        c.fillStyle = "#14202b"; c.font = `700 36px ${FONTE_B}`; quebrar(c, t, 214, yy + 60, W - 330, 40);
      }
    }

    // telefones e fonte
    y = 1146;
    c.fillStyle = "#14202b"; c.font = `700 40px ${FONTE_B}`;
    try { c.drawImage(await carregar(svgIcone("telefone", COR.inundacao, 48)), 60, y, 48, 48); } catch { /* */ }
    c.fillText("199 Defesa Civil   ·   193 Bombeiros", 124, y + 40);
    c.fillStyle = "#566573"; c.font = `400 26px ${FONTE_B}`;
    c.fillText(e && !e.simulado ? `Fonte: ANA, régua do Cais Mauá (${GG.CONFIG.guaiba.caisMaua.alerta / 100} m alerta · ${GG.CONFIG.guaiba.caisMaua.inundacao / 100} m inundação)` : "Nível de treino. O nível real vem da ANA no app publicado.", 60, y + 104);
    c.fillStyle = "#1565c0"; c.font = `700 30px ${FONTE_B}`;
    c.fillText(url().replace(/^https?:\/\//, "").replace(/\/$/, ""), 60, y + 152);

    if (e?.simulado) { // nível de treino nunca sai como real
      caixa(c, 0, 470, W, 50, 0, "#14202b");
      c.fillStyle = "#fff"; c.textAlign = "center"; c.font = `italic 700 38px ${FONTE_D}`; c.fillText("SIMULAÇÃO DE TREINO · NÃO É O NÍVEL REAL", W / 2, 508); c.textAlign = "left";
    }
    return new Promise((ok) => cv.toBlob(ok, "image/png"));
  }

  // a imagem fica pronta antes do toque: o celular só abre o "Compartilhar" logo depois de um toque, sem espera
  let chave = "", preparando = null;
  const chaveAtual = () => { const { e, casa } = dados(); return JSON.stringify([e?.cm, e?.nivel, e?.sobe, casa?.lon, casa?.lat, casa?.bairro]); };
  function preparar() {
    const k = chaveAtual();
    if (k === chave && (ultimoBlob || preparando)) return preparando || Promise.resolve(ultimoBlob);
    chave = k; ultimoBlob = null;
    preparando = gerar().then((b) => { ultimoBlob = b; preparando = null; return b; }).catch(() => (preparando = null));
    return preparando;
  }

  async function enviar(destino) {
    const blob = (chaveAtual() === chave && ultimoBlob) || await preparar();
    if (!blob) return GG.toast("Não consegui montar a imagem.", "erro");
    const file = new File([blob], "guga-alerta.png", { type: "image/png" }), texto = mensagem();
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share(destino === "instagram" ? { files: [file] } : { files: [file], text: texto }); return; }
      catch (err) { if (err?.name === "AbortError") return; }
    }
    // computador ou navegador sem compartilhar arquivo
    if (destino === "whatsapp") { open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener"); return; }
    await GG.baixar("guga-alerta.png", blob, "image/png");
    if (destino === "instagram") GG.toast("Imagem salva. No Instagram, toque em + e escolha a imagem do GuGa.");
  }

  async function abrir() {
    const f = GG.$("#folha-compartilhar");
    f.hidden = false;
    const box = GG.$("#comp-conteudo");
    box.innerHTML = `<div class="comp-previa"><p class="mut">Montando a imagem…</p></div>`;
    const blob = await preparar();
    const src = URL.createObjectURL(blob);
    box.innerHTML = `<div class="comp-previa"><img src="${src}" alt="Imagem do alerta do GuGa com o nível do Guaíba"></div>
      <div class="comp-botoes">
        <button class="btn zap" data-dest="whatsapp">${GG.ic("whatsapp", 22)}WhatsApp</button>
        <button class="btn insta" data-dest="instagram">${GG.ic("instagram", 20)}Instagram</button>
        <button class="btn leve" data-dest="baixar" aria-label="Salvar a imagem">${GG.ic("baixar", 22)}</button>
      </div>
      <p class="mut peq">Abre a lista do celular: escolha a conversa ou o grupo da família.</p>
      <details><summary>Ver o texto que vai junto</summary><div class="zap-msg">${GG.esc(mensagem())}</div></details>`;
    GG.$$("[data-dest]", box).forEach((b) => b.onclick = () => b.dataset.dest === "baixar" ? GG.baixar("guga-alerta.png", ultimoBlob, "image/png") : enviar(b.dataset.dest));
  }

  function iniciar() {
    const f = GG.$("#folha-compartilhar");
    f.addEventListener("click", (e) => { if (e.target === f || e.target.closest("[data-fechar]")) f.hidden = true; });
    document.addEventListener("click", (e) => {
      const d = e.target.closest("[data-enviar]");
      if (d) { e.preventDefault(); enviar(d.dataset.enviar); return; }
      if (e.target.closest("[data-compartilhar]")) { e.preventDefault(); abrir(); }
    });
    // monta a imagem com calma, quando o nível ou a casa mudam
    const depois = () => (window.requestIdleCallback || setTimeout)(() => preparar(), { timeout: 3000 });
    GG.on("nivel", depois); GG.on("casa", depois);
  }
  return { iniciar, abrir, gerar, mensagem, enviar, preparar };
})();
