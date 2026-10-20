/* GuGa · relatar: bueiro, situação do lugar, pedido de socorro (pessoas e animais). 4 passos, botões grandes. */
GG.relatar = (() => {
  const M = GG.modelo;
  let st = null;
  const novo = (p = {}) => ({ passo: 0, tipo: null, sub: null, lon: null, lat: null, local: "", bairro: null, descricao: "", fotos: [], sos: { pessoas: 1, criancas: 0, idosos: 0, animais: 0, especies: [], agua: null }, contato: "", ...p });

  const ICONES = {
    sos: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--crit)" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>`,
    animais: `<svg viewBox="0 0 24 24" width="26" height="26" fill="var(--alert)"><circle cx="6" cy="9" r="2.2"/><circle cx="10" cy="5.5" r="2.2"/><circle cx="14" cy="5.5" r="2.2"/><circle cx="18" cy="9" r="2.2"/><path d="M12 11c-3.5 0-6 4-6 6.5 0 1.6 1.4 2.5 3 2.5 1.3 0 2-.6 3-.6s1.7.6 3 .6c1.6 0 3-.9 3-2.5C18 15 15.5 11 12 11z"/></svg>`,
    bueiro: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 7v10M11 7v10M15 7v10M19 7v10"/></svg>`,
    situacao: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--water)" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  };

  function abrir(pre = {}) {
    st = novo(pre);
    if (pre.tipo) st.passo = 1;
    GG.$("#folha-relatar").hidden = false;
    render();
    GG.$("#folha-relatar .corpo").focus();
  }
  function fechar() { GG.$("#folha-relatar").hidden = true; st = null; }

  function render() {
    const c = GG.$("#relatar-conteudo");
    const nP = 4;
    GG.$("#relatar-passos").innerHTML = Array.from({ length: nP }, (_, i) => `<i class="${i <= st.passo ? "on" : ""}"></i>`).join("");
    GG.$("#relatar-titulo").textContent = ["O que você quer marcar?", st.tipo === "sos" ? "Quem precisa de ajuda?" : st.tipo === "animais" ? "Quais animais?" : "O que você viu?", "Onde é?", st.tipo === "sos" || st.tipo === "animais" ? "Enviar pedido" : "Tire uma foto"][st.passo];
    c.innerHTML = [passoTipo, passoDetalhe, passoLocal, passoEnvio][st.passo]();
    ligar[st.passo]?.();
  }

  const passoTipo = () => `
    <div class="opcoes" style="grid-template-columns:1fr">
      <button class="opcao sos" data-tipo="sos" style="border-color:var(--crit);min-height:80px"><span class="ic">${ICONES.sos}</span><span>Preciso de ajuda urgente<small>Pessoas ilhadas ou em perigo</small></span></button>
      <button class="opcao" data-tipo="animais"><span class="ic">${ICONES.animais}</span><span>Animais precisam de ajuda</span></button>
      <button class="opcao" data-tipo="bueiro"><span class="ic">${ICONES.bueiro}</span><span>Bueiro entupido ou quebrado<small>Fica público no De Olho na Rua</small></span></button>
      <button class="opcao" data-tipo="situacao"><span class="ic">${ICONES.situacao}</span><span>Como está este lugar<small>Seguro, alagando ou perigoso</small></span></button>
    </div>
    <p class="nota">Em perigo de vida, ligue também <b>193</b> (Bombeiros).</p>`;

  function contador(id, rot, val, min = 0) {
    return `<div class="linha" style="justify-content:space-between"><span style="font-weight:700;font-size:1.05rem">${rot}</span>
      <div class="contador" role="group" aria-label="${rot}"><button type="button" data-c="${id}" data-d="-1" aria-label="Menos">−</button><output id="c-${id}">${val}</output><button type="button" data-c="${id}" data-d="1" aria-label="Mais">+</button></div></div>`;
  }
  function passoDetalhe() {
    const t = M.TIPOS[st.tipo];
    if (st.tipo === "bueiro" || st.tipo === "situacao") {
      return `<div class="opcoes" style="grid-template-columns:1fr">${Object.entries(t.subs).map(([k, v]) => `<button class="opcao ${v.problema ? "" : ""}" data-sub="${k}" aria-pressed="${st.sub === k}"><span class="ic"><span style="width:16px;height:16px;border-radius:50%;background:${v.problema ? "var(--crit)" : "var(--accent)"}"></span></span>${v.rotulo}</button>`).join("")}</div>
        <label class="campo">Detalhes (opcional)<textarea id="r-desc" maxlength="400" placeholder="Ex.: na esquina com a Rua X, em frente ao mercado">${GG.esc(st.descricao)}</textarea></label>`;
    }
    const s = st.sos;
    const agua = `<fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><legend style="font-weight:700;margin-bottom:8px">Até onde está a água?</legend>
      <div class="opcoes">${M.AGUA.map((a) => `<button class="opcao" data-agua="${a.id}" aria-pressed="${s.agua === a.id}">${a.rotulo}</button>`).join("")}</div></fieldset>`;
    const especies = `<fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;margin-bottom:8px">Quais animais?</legend><div class="opcoes">${M.ESPECIES.map((e) => `<label class="opcao"><input type="checkbox" value="${e}" ${s.especies.includes(e) ? "checked" : ""} data-esp>${e[0].toUpperCase() + e.slice(1)}</label>`).join("")}</div></fieldset>`;
    if (st.tipo === "animais") return `<div class="pilha">${contador("animais", "Quantos animais?", Math.max(1, s.animais), 1)}${especies}${agua}
      <label class="campo">Detalhes (opcional)<textarea id="r-desc" maxlength="400" placeholder="Ex.: cachorros presos no pátio dos fundos">${GG.esc(st.descricao)}</textarea></label></div>`;
    return `<div class="pilha">
      ${contador("pessoas", "Quantas pessoas?", s.pessoas, 1)}
      ${contador("criancas", "Crianças ou bebês", s.criancas)}
      ${contador("idosos", "Idosos (60+)", s.idosos)}
      <div class="opcoes">
        <label class="opcao"><input type="checkbox" id="r-pcd" ${s.pcd ? "checked" : ""}>Acamado, com deficiência ou doente</label>
        <label class="opcao"><input type="checkbox" id="r-gest" ${s.gestante ? "checked" : ""}>Gestante</label>
        <label class="opcao"><input type="checkbox" id="r-rem" ${s.semRemedio ? "checked" : ""}>Falta remédio essencial</label>
      </div>
      ${agua}
      ${contador("animais", "Animais junto com vocês", s.animais)}
      ${s.animais ? especies : ""}
      <label class="campo">Telefone para a equipe de resgate (opcional)<span class="dica">Só equipes de resgate veem. Nunca aparece no mapa público.</span><input type="tel" id="r-tel" inputmode="tel" autocomplete="tel" value="${GG.esc(st.contato)}" placeholder="(51) 9…"></label>
      <label class="campo">Algo mais que o resgate precisa saber?<textarea id="r-desc" maxlength="400" placeholder="Ex.: casa azul de dois andares, estamos no andar de cima">${GG.esc(st.descricao)}</textarea></label>
    </div>`;
  }

  function passoLocal() {
    const casa = GG.casa.salva();
    return `<div class="pilha">
      <div class="opcoes" style="grid-template-columns:1fr">
        <button class="opcao" id="l-gps">Usar minha localização agora</button>
        <button class="opcao" id="l-mapa">Marcar no mapa</button>
        ${casa ? `<button class="opcao" id="l-casa">Na minha casa salva (${GG.esc(casa.bairro || casa.rotulo || "")})</button>` : ""}
      </div>
      <div id="l-escolhido">${st.lat ? localTxt() : `<p class="mut">Nenhum local escolhido ainda.</p>`}</div>
      <label class="campo">Ponto de referência (opcional)<input type="text" id="r-ref" value="${GG.esc(st.local)}" placeholder="Ex.: esquina da Av. Ipiranga com a Rua X"></label>
    </div>`;
  }
  const localTxt = () => `<div class="card borda"><b>Local marcado</b>${st.bairro ? ` · ${GG.esc(st.bairro)}` : ""}<br><span class="mono mut">${st.lat.toFixed(5)}, ${st.lon.toFixed(5)}</span></div>`;

  function passoEnvio() {
    const t = M.TIPOS[st.tipo];
    const pr = M.prioridade({ ...st, criadoEm: new Date().toISOString(), confirmacoes: 0 });
    const sos = st.tipo === "sos" || st.tipo === "animais";
    return `<div class="pilha">
      <label class="foto-grande" for="r-foto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>
        ${st.fotos.length ? "Tirar outra foto" : sos ? "Foto do local (se puder)" : "Tirar foto"}<span class="mut peq" style="font-weight:400">${sos ? "Ajuda o resgate a achar vocês." : "A foto vai para o De Olho na Rua. Mostre o problema, evite rostos e placas."}</span></label>
      <input type="file" id="r-foto" accept="image/*" capture="environment" multiple class="sr">
      <div class="foto-prev">${st.fotos.map((f) => `<img src="${f.url}" alt="Foto escolhida">`).join("")}</div>
      <div class="card"><b>${GG.esc(t.subs[st.sub]?.rotulo || t.rotulo)}</b><br>${st.bairro ? GG.esc(st.bairro) + " · " : ""}<span class="mono mut">${st.lat?.toFixed(5)}, ${st.lon?.toFixed(5)}</span>
      ${pr.total ? `<p style="margin-top:8px">Prioridade calculada: <b class="mono">${pr.total}</b> · ${M.faixaPrioridade(pr.total).rot}</p>` : ""}</div>
      ${st.tipo === "sos" ? `<div class="card borda" style="border-color:var(--crit)"><b style="color:var(--crit)">Ligue também para o 193.</b> Sem sinal para ligar? Mande este texto por SMS para alguém da família.<div class="zap-msg mono" style="margin-top:8px;font-size:.85rem" id="sms-txt">${GG.esc(textoSMS())}</div><button class="btn" id="copiar-sms" style="margin-top:8px">Copiar texto</button></div>` : ""}
    </div>`;
  }
  const textoSMS = () => `SOCORRO ${st.sos.pessoas || 1} pessoa(s)${st.sos.criancas ? `, ${st.sos.criancas} crianca(s)` : ""}${st.sos.idosos ? `, ${st.sos.idosos} idoso(s)` : ""}. Agua: ${M.AGUA.find((a) => a.id === st.sos.agua)?.rotulo || "?"}. Local: ${st.lat?.toFixed(5)},${st.lon?.toFixed(5)} https://maps.google.com/?q=${st.lat?.toFixed(5)},${st.lon?.toFixed(5)} ${st.local || ""}`;

  async function definirLocal(lon, lat) {
    st.lon = lon; st.lat = lat;
    try { const a = await GG.data.analisar(lon, lat); st.bairro = a.bairro; } catch { /* sem bairro */ }
    if (GG.$("#l-escolhido")) GG.$("#l-escolhido").innerHTML = localTxt();
  }

  async function reduzirFoto(file) {
    const img = await createImageBitmap(file).catch(() => null);
    if (!img) throw new Error("Formato de foto não suportado. Tente JPG ou PNG.");
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.78));
    return { blob, url: cv.toDataURL("image/jpeg", 0.5) };
  }

  const ligar = [
    () => GG.$$("[data-tipo]").forEach((b) => b.onclick = () => { st.tipo = b.dataset.tipo; st.sub = st.tipo === "sos" ? "pessoas" : st.tipo === "animais" ? "animais" : null; if (st.tipo === "animais") st.sos.animais = Math.max(1, st.sos.animais); st.passo = 1; render(); }),
    () => {
      GG.$$("[data-sub]").forEach((b) => b.onclick = () => { st.sub = b.dataset.sub; GG.$$("[data-sub]").forEach((x) => x.setAttribute("aria-pressed", x === b)); });
      GG.$$("[data-agua]").forEach((b) => b.onclick = () => { st.sos.agua = b.dataset.agua; GG.$$("[data-agua]").forEach((x) => x.setAttribute("aria-pressed", x === b)); });
      GG.$$("[data-c]").forEach((b) => b.onclick = () => {
        const k = b.dataset.c, min = k === "pessoas" || (k === "animais" && st.tipo === "animais") ? 1 : 0;
        st.sos[k] = Math.max(min, Math.min(99, (st.sos[k] || 0) + +b.dataset.d));
        GG.$("#c-" + k).textContent = st.sos[k];
        if (k === "animais" && st.tipo === "sos") { salvarCampos(); render(); }
      });
    },
    () => {
      GG.$("#l-gps").onclick = () => {
        if (!navigator.geolocation) return GG.toast("Este aparelho não informa localização. Marque no mapa.", "erro");
        GG.$("#l-escolhido").innerHTML = `<p class="mut">Pegando localização…</p>`;
        navigator.geolocation.getCurrentPosition((p) => definirLocal(p.coords.longitude, p.coords.latitude),
          () => { GG.$("#l-escolhido").innerHTML = `<p>Sem permissão de localização aqui. Use <b>Marcar no mapa</b>.</p>`; }, { enableHighAccuracy: true, timeout: 12000 });
      };
      GG.$("#l-mapa").onclick = async () => {
        salvarCampos();
        GG.$("#folha-relatar").hidden = true;
        const p = await GG.mapa.escolherPonto("Toque no mapa no local exato do relato");
        GG.$("#folha-relatar").hidden = false;
        await definirLocal(p.lon, p.lat); render();
      };
      GG.$("#l-casa")?.addEventListener("click", () => { const c = GG.casa.salva(); definirLocal(c.lon, c.lat); });
    },
    () => {
      GG.$("#r-foto").onchange = async (e) => {
        for (const f of [...e.target.files].slice(0, 3 - st.fotos.length)) {
          try { st.fotos.push(await reduzirFoto(f)); } catch (err) { GG.toast(err.message, "erro"); }
        }
        render();
      };
      GG.$("#copiar-sms")?.addEventListener("click", () => copiar(textoSMS()));
    },
  ];

  function salvarCampos() {
    const v = (id) => GG.$(id)?.value;
    if (GG.$("#r-desc")) st.descricao = v("#r-desc").trim();
    if (GG.$("#r-tel")) st.contato = v("#r-tel").trim();
    if (GG.$("#r-ref")) st.local = v("#r-ref").trim();
    if (GG.$("#r-pcd")) { st.sos.pcd = GG.$("#r-pcd").checked; st.sos.gestante = GG.$("#r-gest").checked; st.sos.semRemedio = GG.$("#r-rem").checked; }
    if (GG.$$("[data-esp]").length) st.sos.especies = GG.$$("[data-esp]:checked").map((x) => x.value);
  }

  function validar() {
    if (st.passo === 1 && !st.sub) return "Escolha uma das opções.";
    if (st.passo === 1 && (st.tipo === "sos" || st.tipo === "animais") && !st.sos.agua) return "Diga até onde está a água. Isso define a prioridade.";
    if (st.passo === 2 && st.lat == null) return "Marque o local: use sua localização ou toque no mapa.";
    return null;
  }

  async function avancar() {
    salvarCampos();
    const erro = validar();
    if (erro) return GG.toast(erro, "erro");
    if (st.passo < 3) { st.passo++; return render(); }
    // limite simples contra abuso: 6 relatos a cada 10 minutos por aparelho
    const recentes = GG.store.get("enviados", []).filter((t) => Date.now() - t < 600000);
    if (recentes.length >= 6 && st.tipo !== "sos") return GG.toast("Muitos relatos em pouco tempo. Aguarde alguns minutos.", "erro");
    const btn = GG.$("#relatar-avancar"); btn.disabled = true; btn.textContent = "Enviando…";
    const relato = {
      tipo: st.tipo, sub: st.sub, lon: +st.lon.toFixed(6), lat: +st.lat.toFixed(6), bairro: st.bairro, cidade: st.bairro ? "Porto Alegre" : (GG.mapa.filtro.cidade || null),
      descricao: [st.descricao, st.local].filter(Boolean).join(" · ").slice(0, 500),
      ...(st.tipo === "sos" || st.tipo === "animais" ? { sos: st.sos } : {}),
      ...(st.contato ? { _privado: { contato: st.contato } } : {}),
    };
    try {
      const r = await GG.backend.enviar(relato, st.fotos.map((f) => f.blob));
      GG.store.set("enviados", [...recentes, Date.now()]);
      const off = r?.offline;
      GG.$("#relatar-conteudo").innerHTML = `<div class="veredito ${off ? "warn" : "ok"}"><p class="grande">${off ? "Guardado no seu celular" : "Marcação enviada"}</p>
        <p>${off ? "Sem internet agora. O GuGa envia sozinho assim que a conexão voltar. Não feche o app sem necessidade." : st.tipo === "sos" ? "Seu pedido entrou na fila de resgate com a prioridade calculada. Continue tentando o 193." : "Obrigado. O relato já aparece no mapa como <b>não verificado</b> e vai para revisão da equipe. Vizinhos podem confirmar."}</p>
        ${r?.id ? `<p class="mono mut">Protocolo ${GG.esc(String(r.id).slice(0, 12))}</p>` : ""}</div>`;
      const podeCobrar = st.tipo === "bueiro" || st.tipo === "situacao";
      const enviado = { ...relato, id: r?.id || null, criadoEm: new Date().toISOString(), confirmacoes: 0, cobrancas: 0, fotos: [] };
      const blob = st.fotos[0]?.blob || null;
      GG.$("#relatar-acoes").innerHTML = podeCobrar
        ? `<div class="pilha" style="width:100%"><p style="font-size:1.08rem"><b>Agora cobre quem resolve.</b> Com um toque a mensagem vai pronta, com a foto e o local, para o WhatsApp do 156, o e-mail da Ouvidoria ou o Instagram.</p>
            <button class="btn primario grande" id="relatar-cobrar">Cobrar a Prefeitura agora</button><button class="btn grande" id="relatar-ok">Depois</button></div>`
        : `<button class="btn primario grande" id="relatar-ok">Fechar</button>`;
      GG.$("#relatar-ok").onclick = fechar;
      GG.$("#relatar-cobrar")?.addEventListener("click", () => { fechar(); GG.cobrar.abrir({ relato: enviado, fotoBlob: blob }); });
    } catch (e) {
      GG.toast("Não foi possível enviar: " + e.message, "erro");
      btn.disabled = false; btn.textContent = "Enviar";
    }
  }

  function copiar(txt) {
    navigator.clipboard?.writeText(txt).then(() => GG.toast("Texto copiado.")).catch(() => {
      const r = document.createRange(); const el = GG.$("#sms-txt") || GG.$(".zap-msg"); if (el) { r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); }
      GG.toast("Texto selecionado. Use Copiar do seu celular.");
    });
  }

  function iniciar() {
    GG.$("#relatar-fechar").onclick = fechar;
    GG.$("#folha-relatar").addEventListener("click", (e) => { if (e.target.id === "folha-relatar") fechar(); });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && st) fechar(); });
    GG.$("#relatar-acoes").addEventListener("click", (e) => {
      if (e.target.id === "relatar-voltar") { salvarCampos(); st.passo = Math.max(0, st.passo - 1); render(); renderAcoes(); }
      if (e.target.id === "relatar-avancar") avancar().then(() => st && st.passo <= 3 && GG.$("#relatar-avancar") && renderAcoes());
    });
    const _r = render;
    render = () => { _r(); renderAcoes(); }; // eslint-disable-line no-func-assign
  }
  function renderAcoes() {
    if (!st) return;
    GG.$("#relatar-acoes").innerHTML = st.passo === 0 ? "" : `<button class="btn" id="relatar-voltar">Voltar</button><button class="btn primario" id="relatar-avancar" style="flex:1">${st.passo === 3 ? (st.tipo === "sos" ? "Enviar pedido de socorro" : st.fotos.length ? "Enviar" : "Enviar sem foto") : "Continuar"}</button>`;
  }

  return { abrir, fechar, iniciar, copiar, reduzirFoto };
})();
