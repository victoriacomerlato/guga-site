/* GuGa · Cobrar quem resolve. A marcação não fica parada no app: com um toque, o morador manda a cobrança
   pelo próprio WhatsApp, e-mail, Instagram ou formulário oficial, com foto, local e há quantos dias espera.
   Quem envia é o morador (vale como pedido de cidadão); o GuGa conta quantas pessoas cobraram e guarda os protocolos. */
GG.cobrar = (() => {
  const C = () => GG.CONFIG.cobranca;
  let atual = null; // { relato, fotoBlob, texto, bairro, alvo }

  const IC = {
    whatsapp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1-1.2 2 1-.4 1.6c-3.6.3-7.7-3.8-7.4-7.4L10.3 7l1 2z" fill="currentColor" stroke="none"/></svg>`,
    email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14"/><path d="m3 6 9 7 9-7"/></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4l16 16M20 4 4 20"/></svg>`,
    tel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>`,
    foto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>`,
  };

  const hoje = () => new Date().toISOString().slice(0, 10);
  const chefe = (o) => (o.chefe || []).find((c) => hoje() < c.ate) || o.chefe?.at(-1) || {};
  const prefeitura = (cidade) => C().prefeitura[cidade || "Porto Alegre"] || C().prefeitura["Porto Alegre"];
  const dias = (r) => Math.max(0, Math.floor((Date.now() - new Date(r.criadoEm || Date.now())) / 864e5));
  const rotulo = (r) => GG.modelo.TIPOS[r.tipo]?.subs?.[r.sub]?.rotulo || GG.modelo.TIPOS[r.tipo]?.rotulo || "Problema";
  const mapa = (r) => `https://www.google.com/maps?q=${(+r.lat).toFixed(6)},${(+r.lon).toFixed(6)}`;
  function linkPublico() {
    if (GG.CONFIG.urlPublica) return GG.CONFIG.urlPublica.replace(/\/?$/, "/") + "#de-olho";
    const h = location.host;
    return /^https?:$/.test(location.protocol) && h && !/claude\.ai|claudeusercontent|localhost|127\.0\.0\.1/.test(h) ? location.origin + location.pathname + "#de-olho" : null;
  }

  function nome() { return GG.store.get("cobranca_nome", ""); }

  /** Texto da cobrança. Direto, com local, foto e tempo de espera: é o que faz uma reclamação ser atendida. */
  function mensagem(alvo) {
    const { relato: r, texto, bairro } = atual, n = nome().trim();
    const P = prefeitura(r?.cidade), E = C().estado, cp = chefe(P), ce = chefe(E);
    const para = alvo === "prefeitura" ? `À ${P.orgao}, ao ${cp.nome}` : `À Ouvidoria do ${E.orgao}, ao ${ce.nome}${ce.eleito ? ` e ao ${ce.eleito}` : ""}`;
    const assina = n ? `${n}, morador(a)${(r?.bairro || bairro) ? ` do bairro ${r?.bairro || bairro}` : ""}` : `Um morador${(r?.bairro || bairro) ? ` do bairro ${r?.bairro || bairro}` : ""}`;
    const link = linkPublico();
    if (texto) return `${para}.\n\n${texto}\n\n${assina}${link ? `\nAcompanhe: ${link}` : ""}`;
    const d = dias(r), foto = r.fotos?.find((f) => /^https?:/.test(f.url))?.url;
    const pedido = alvo === "prefeitura"
      ? "Peço a limpeza ou o conserto e um prazo para a solução. A previsão é de chuva acima da média nesta primavera: bueiro entupido é água dentro das casas."
      : "Peço que o Estado acompanhe este caso com a Prefeitura e informe o que está sendo feito na proteção contra cheias deste bairro.";
    return [
      `${para}.`, "",
      `${rotulo(r)}${r.bairro ? ` no bairro ${r.bairro}` : ""}${r.cidade ? `, ${r.cidade}` : ""}.${r.descricao ? ` ${r.descricao}.` : ""}`,
      `Local exato: ${mapa(r)}`,
      `Marcado por moradores no GuGa ${d === 0 ? "hoje" : `há ${d} dia${d === 1 ? "" : "s"}, ainda sem solução`}.${r.confirmacoes ? ` ${r.confirmacoes} vizinho${r.confirmacoes === 1 ? " confirmou" : "s confirmaram"}.` : ""}`,
      ...(foto ? [`Foto: ${foto}`] : []),
      ...(r.protocolos?.length ? [`Protocolo já aberto: ${r.protocolos.map((p) => p.numero).join(", ")}.`] : []),
      "", pedido, "", assina, ...(link ? [`Acompanhe: ${link}`] : []),
    ].join("\n");
  }

  // versão curta para o X e para a legenda do Instagram
  function curta(usuario) {
    const { relato: r, bairro } = atual;
    if (!r) return `@${usuario} Moradores do bairro ${bairro} cobram solução para bueiros entupidos e pontos de alagamento. #DeOlhoNaRua`;
    const d = dias(r);
    return `@${usuario} ${rotulo(r)}${r.bairro ? ` no bairro ${r.bairro}` : ""}${d ? `, há ${d} dia${d === 1 ? "" : "s"} sem solução` : ""}. Local: ${mapa(r)} #DeOlhoNaRua`;
  }

  function assunto() {
    const { relato: r, bairro } = atual;
    return r ? `Cobrança: ${rotulo(r).toLowerCase()} no bairro ${r.bairro || r.cidade || ""}${dias(r) ? ` há ${dias(r)} dias` : ""}` : `Cobrança dos moradores do bairro ${bairro}`;
  }

  async function copiar(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch { return false; }
  }

  async function agir(canal, alvo) {
    const r = atual.relato;
    if (r?.demo) return GG.toast("Cartão de exemplo. Numa marcação real, este botão abre o canal com a mensagem pronta.");
    const msg = GG.$("#cob-msg").value;
    const enc = encodeURIComponent;
    let url = null;
    if (canal.tipo === "whatsapp") url = `https://wa.me/${canal.numero}?text=${enc(msg)}`;
    if (canal.tipo === "email") url = `mailto:${canal.para}?subject=${enc(assunto())}&body=${enc(msg)}`;
    if (canal.tipo === "link") { await copiar(msg); url = canal.url; }
    if (canal.tipo === "instagram") { await copiar(msg); url = `https://ig.me/m/${canal.usuario}`; }
    if (canal.tipo === "x") url = `https://twitter.com/intent/tweet?text=${enc(curta(canal.usuario))}`;
    if (canal.tipo === "tel") url = `tel:${canal.numero}`;
    if (url) {
      if (canal.tipo === "tel" || canal.tipo === "email") location.href = url; else open(url, "_blank", "noopener");
    }
    GG.toast(canal.dica || (canal.tipo === "instagram" ? `Mensagem copiada. Cole na conversa com @${canal.usuario}.` : "Obrigado por cobrar. Se receber um protocolo, cole aqui embaixo."));
    if (r?.id) { await GG.backend.cobrar(r.id, canal.id); contador(); }
  }

  async function postarComFoto() {
    const { relato: r, fotoBlob } = atual;
    if (r?.demo) return GG.toast("Cartão de exemplo. Numa marcação real, isto abre o Instagram, o Facebook ou o grupo do bairro com a foto.");
    const txt = curta("prefpoa");
    await copiar(txt);
    let blob = fotoBlob || null;
    const url = r?.fotos?.[0]?.url;
    if (!blob && url) blob = await fetch(url).then((x) => x.ok ? x.blob() : null).catch(() => null);
    const files = blob ? [new File([blob], "guga-de-olho-na-rua.jpg", { type: blob.type || "image/jpeg" })] : [];
    try {
      if (files.length && navigator.canShare?.({ files })) await navigator.share({ files, text: txt });
      else if (navigator.share) await navigator.share({ text: txt });
      else return GG.toast("Texto copiado. Cole no Instagram ou no Facebook e marque @prefpoa.");
      GG.toast("Se o Instagram não levar o texto, ele está copiado: cole na legenda.");
      if (r?.id) { await GG.backend.cobrar(r.id, "post"); contador(); }
    } catch (e) { if (e.name !== "AbortError") GG.toast("Não deu para abrir o compartilhamento. O texto foi copiado.", "erro"); }
  }

  function contador() {
    const el = GG.$("#cob-contagem"); if (!el || !atual.relato) return;
    const r = GG.backend.relatos().find((x) => x.id === atual.relato.id) || atual.relato;
    const n = r.cobrancas || 0, ps = r.protocolos || [];
    el.innerHTML = `${n ? `<b>${n}</b> ${n === 1 ? "cobrança enviada" : "cobranças enviadas"} por moradores.` : "Ninguém cobrou ainda. Seja o primeiro."}
      ${ps.map((p) => `<span class="protocolo">Protocolo ${p.orgao === "estado" ? "do Estado" : "da Prefeitura"} nº <b>${GG.esc(p.numero)}</b>, aberto ${GG.tempo(p.em)}</span>`).join("")}`;
  }

  function render() {
    const alvo = atual.alvo, r = atual.relato;
    const O = alvo === "prefeitura" ? prefeitura(r?.cidade) : C().estado, ch = chefe(O);
    GG.$("#cobrar-conteudo").innerHTML = `
      <div class="modos" role="group" aria-label="Para quem">
        <button data-alvo="prefeitura" aria-pressed="${alvo === "prefeitura"}">Prefeitura</button>
        <button data-alvo="estado" aria-pressed="${alvo === "estado"}">Governo do Estado</button>
      </div>
      <p class="cob-quem"><b>${GG.esc(O.orgao)}</b>${ch.nome ? `, ${GG.esc(ch.nome)}` : ""}${ch.eleito ? ` (e o ${GG.esc(ch.eleito)})` : ""}.<br><span class="mut">${GG.esc(O.responsavel)}</span></p>
      ${r ? `<p class="cob-contagem" id="cob-contagem"></p>` : ""}
      ${r?.demo ? `<p class="demo-faixa">Cartão de exemplo: veja como fica a mensagem. Numa marcação real os botões abrem cada canal.</p>` : ""}
      <label class="campo">Seu nome (opcional)<span class="dica">Cobrança com nome tem mais força. Fica só neste celular.</span><input type="text" id="cob-nome" autocomplete="name" value="${GG.esc(nome())}"></label>
      <p class="cob-passo"><b>Toque onde quer mandar.</b> A mensagem já vai pronta, com o local e há quantos dias o problema espera.</p>
      <div class="canais">${O.canais.map((c, i) => `<button class="canal ${c.tipo}" data-canal="${i}"><span class="ic">${IC[c.tipo] || IC.link}</span><span><b>${GG.esc(c.rot)}</b><small>${GG.esc(c.sub || "")}</small></span></button>`).join("")}
        <button class="canal foto" id="cob-postar"><span class="ic">${IC.foto}</span><span><b>Postar com a foto</b><small>Instagram, Facebook, grupo do bairro</small></span></button></div>
      <details class="cob-msg"><summary>Ver ou mudar a mensagem</summary><textarea id="cob-msg" rows="9" aria-label="Mensagem da cobrança" style="margin-top:8px"></textarea></details>
      ${r && !r.demo && r.id ? `<details class="cob-prot"><summary>Recebeu um número de protocolo?</summary>
        <div class="linha" style="margin-top:8px"><input type="text" id="cob-num" placeholder="Ex.: 2026-123456" style="flex:1 1 180px" inputmode="text"><button class="btn primario" id="cob-salvar">Salvar protocolo</button></div>
        <p class="mut peq">Fica público no cartão, com a data. Assim todo mundo vê há quanto tempo o pedido oficial está aberto.</p></details>` : ""}
      <p class="nota">Quem envia é você, do seu celular: chega como pedido de um morador. Canais oficiais conferidos em ${new Date(C().conferidoEm + "T12:00").toLocaleDateString("pt-BR")}.</p>`;
    const caixa = GG.$("#cob-msg");
    caixa.value = mensagem(alvo);
    GG.$("#cob-nome").oninput = (e) => { GG.store.set("cobranca_nome", e.target.value.slice(0, 60)); caixa.value = mensagem(alvo); };
    GG.$$("[data-alvo]").forEach((b) => b.onclick = () => { atual.alvo = b.dataset.alvo; render(); });
    GG.$$("[data-canal]").forEach((b) => b.onclick = () => agir(O.canais[+b.dataset.canal], alvo));
    GG.$("#cob-postar").onclick = postarComFoto;
    GG.$("#cob-salvar")?.addEventListener("click", async () => {
      try { await GG.backend.protocolo(r.id, alvo, GG.$("#cob-num").value); GG.toast("Protocolo salvo. Agora ele aparece no cartão."); GG.$("#cob-num").value = ""; setTimeout(contador, 300); }
      catch (e) { GG.toast(e.message, "erro"); }
    });
    contador();
  }

  /** opts: { relato, fotoBlob } para um problema; ou { texto, bairro } para a cobrança do bairro inteiro. */
  function abrir(opts) {
    atual = { alvo: opts.alvo || "prefeitura", ...opts };
    GG.$("#folha-cobrar").hidden = false;
    render();
    GG.$("#folha-cobrar .corpo").scrollTop = 0;
  }
  function fechar() { GG.$("#folha-cobrar").hidden = true; atual = null; }

  function iniciar() {
    const f = GG.$("#folha-cobrar");
    f.addEventListener("click", (e) => { if (e.target === f || e.target.closest("[data-fechar]")) fechar(); });
    GG.backend.ouvir(() => atual && !f.hidden && contador());
  }
  return { iniciar, abrir, fechar, mensagem: (alvo) => mensagem(alvo) };
})();
