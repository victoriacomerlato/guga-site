/* GuGa · Colocar o GuGa na tela do celular. No Android usa o botão "Instalar" do próprio navegador quando ele existe;
   no iPhone mostra o caminho pelo botão Compartilhar. Some quando o app já está instalado. */
GG.instalar = (() => {
  let pedido = null; // evento beforeinstallprompt (Android/Chrome)
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const instalado = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  const IC_COMPARTILHAR = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-label="ícone Compartilhar"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>`;
  const IC_MENU = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-label="ícone de três pontinhos"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`;
  const IC_MAIS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-label="ícone de mais"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`;

  function passosAndroid() {
    return `<ol class="passos">
      ${pedido ? `<li><span><b>Toque em "Instalar o GuGa"</b>O próprio celular pergunta. Confirme.</span></li>` : `
      <li><span><b>Toque nos três pontinhos ${IC_MENU}</b>No canto de cima, à direita, do Chrome.</span></li>
      <li><span><b>Escolha "Instalar app" ou "Adicionar à tela inicial"</b>Depende do modelo do celular.</span></li>`}
      <li><span><b>Pronto</b>O escudo do GuGa aparece junto com os outros aplicativos. Funciona até sem internet.</span></li></ol>`;
  }
  function passosIphone() {
    return `<ol class="passos">
      <li><span><b>Abra o GuGa no Safari</b>É o navegador da bússola azul. No Chrome do iPhone também funciona.</span></li>
      <li><span><b>Toque em Compartilhar ${IC_COMPARTILHAR}</b>O quadrado com a seta para cima, na barra de baixo (ou em cima, no iPad).</span></li>
      <li><span><b>Escolha "Adicionar à Tela de Início" ${IC_MAIS}</b>Se não aparecer, role a lista para baixo.</span></li>
      <li><span><b>Toque em "Adicionar"</b>O escudo do GuGa aparece na tela, como um aplicativo.</span></li></ol>`;
  }

  function conteudo(qual) {
    const so = qual || (ios ? "iphone" : "android");
    return `<div class="instalar-topo"><img src="icons/guga-180.png" alt="Ícone do GuGa" width="72" height="72"><p>O ícone do GuGa fica na tela do celular, como um aplicativo. Abre com um toque e funciona sem internet.</p></div>
      <div class="modos" role="group" aria-label="Tipo de celular"><button data-so="android" aria-pressed="${so === "android"}">Android</button><button data-so="iphone" aria-pressed="${so === "iphone"}">iPhone</button></div>
      ${so === "android" && pedido ? `<button class="btn primario grande" id="instalar-ja">Instalar o GuGa</button>` : ""}
      ${so === "android" ? passosAndroid() : passosIphone()}`;
  }

  function abrir(qual) {
    const f = GG.$("#folha-instalar");
    f.hidden = false;
    const desenhar = (q) => {
      GG.$("#instalar-conteudo").innerHTML = conteudo(q);
      GG.$$("[data-so]", f).forEach((b) => b.onclick = () => desenhar(b.dataset.so));
      GG.$("#instalar-ja")?.addEventListener("click", instalarJa);
    };
    desenhar(qual);
  }

  async function instalarJa() {
    if (!pedido) return abrir("android");
    pedido.prompt();
    const r = await pedido.userChoice.catch(() => null);
    pedido = null;
    if (r?.outcome === "accepted") { GG.toast("GuGa instalado. Procure o escudo na tela do celular."); dispensar(); GG.$("#folha-instalar").hidden = true; }
  }

  function dispensar() { GG.store.set("instalar_dispensado", Date.now()); GG.$("#inicio-instalar").innerHTML = ""; }

  // aviso discreto na tela inicial (só no celular, só se ainda não instalou; volta depois de 30 dias se dispensado)
  function aviso() {
    const box = GG.$("#inicio-instalar");
    if (!box) return;
    const dispensado = GG.store.get("instalar_dispensado", 0);
    if (instalado() || (!ios && !android && !pedido) || Date.now() - dispensado < 30 * 864e5 || window.claude?.use) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="instalar-aviso"><img src="icons/guga-180.png" alt="" width="52" height="52">
      <span><b>Coloque o GuGa na tela do celular</b><small>${ios ? "No iPhone: Compartilhar e depois \"Adicionar à Tela de Início\"." : "Um toque e ele fica junto com os seus aplicativos."}</small></span>
      <button class="btn primario" id="instalar-abrir">${pedido ? "Instalar" : "Como fazer"}</button><button class="btn-icone" id="instalar-fechar" aria-label="Agora não">✕</button></div>`;
    GG.$("#instalar-abrir").onclick = () => pedido ? instalarJa() : abrir();
    GG.$("#instalar-fechar").onclick = dispensar;
  }

  function iniciar() {
    addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pedido = e; aviso(); });
    addEventListener("appinstalled", () => { pedido = null; aviso(); });
    const f = GG.$("#folha-instalar");
    f.addEventListener("click", (e) => { if (e.target === f || e.target.closest("[data-fechar]")) f.hidden = true; });
    aviso();
  }
  return { iniciar, abrir, aviso };
})();
