/* GuGa · inicialização, navegação, barra do topo, acessibilidade, offline. */
(() => {
  const VISTAS = ["inicio", "mapa", "vergonha", "casa", "guia", "morro", "resgate"];

  let vistaAtual = "inicio";
  GG.vistaAtual = () => vistaAtual;
  GG.ir = (v) => {
    if (v === "relatar") { GG.relatar.abrir(); return; }
    if (v === "mais") { GG.$("#folha-mais").hidden = false; return; }
    if (v === "simular") { GG.ir("mapa"); GG.simulador.ligar(true); return; }
    if (v === "de-olho" || v === "espera") v = "vergonha"; // nome público: De Olho na Rua
    if (!VISTAS.includes(v)) v = "inicio";
    if (v !== "mapa" && GG.simulador?.ativo) GG.simulador.ligar(false);
    if (v !== vistaAtual) { GG.voz?.parar(); GG.guia?.parar(); } // a voz não continua falando em outra tela
    vistaAtual = v;
    VISTAS.forEach((x) => { GG.$("#v-" + x).hidden = x !== v; });
    const rota = v === "vergonha" ? "de-olho" : v;
    GG.$$("[data-nav]").forEach((a) => (a.dataset.nav === v || a.dataset.nav === rota) && !a.classList.contains("marca") && !a.classList.contains("nivel") ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    GG.$("#folha-mais").hidden = true;
    if (location.hash !== "#" + rota) history.replaceState(null, "", "#" + rota);
    if (v === "mapa") setTimeout(() => GG.mapa.resize(), 30);
    if (v === "morro") GG.morro.mostrar();
    if (v === "vergonha") GG.vergonha.render();
    if (v === "resgate") GG.resgate.render();
    if (v === "inicio") GG.inicio.render();
    GG.$("#v-" + v).scrollTop = 0;
  };

  // Baixar arquivo: capability "downloads" na prévia; link Blob no app publicado.
  GG.baixar = async (nome, conteudo, tipo) => {
    if (window.claude?.use) {
      const d = await claude.use("downloads");
      if (d) { try { await d.save({ filename: nome, data: conteudo }); return; } catch (e) { if (e.code === "declined") return; } }
      return GG.toast("Download indisponível nesta prévia.", "erro");
    }
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = Object.assign(document.createElement("a"), { href: url, download: nome });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Estado do Guaíba em palavras simples
  GG.estadoGuaiba = (nv) => {
    if (!nv?.serie?.length) return null;
    const cm = nv.serie.at(-1).cm, t = GG.live.tendencia(nv.serie), G = GG.CONFIG.guaiba.caisMaua;
    const nivel = cm >= G.inundacao ? "inundacao" : cm >= G.alerta ? "alerta" : cm >= G.alerta - 30 ? "atencao" : "normal";
    const rot = { normal: "Normal", atencao: "Atenção", alerta: "Alerta", inundacao: "Inundação" }[nivel];
    const sobe = t && t.cmh > 0.3, desce = t && t.cmh < -0.3;
    const mov = sobe ? (t.cmh > 3 ? "subindo rápido" : "subindo") : desce ? "baixando" : "parado";
    return { cm, t, nivel, rot, sobe, desce, mov, simulado: nv.simulado, fonte: nv.fonte };
  };

  function statusNivel(nv) {
    const e = GG.estadoGuaiba(nv), el = GG.$("#chip-nivel");
    if (!e) { el.innerHTML = `<span class="pt"></span>Guaíba —`; return; }
    el.className = "nivel" + (e.nivel === "alerta" || e.nivel === "inundacao" ? " alerta" : "");
    el.innerHTML = `<span class="pt ${e.nivel === "inundacao" ? "pisca" : ""}" style="background:${GG.COR_ESTADO[e.nivel]}"></span>Guaíba ${GG.m(e.cm)} ${e.sobe ? "↑" : e.desce ? "↓" : ""}${e.simulado ? ` <small>treino</small>` : ""}`;
    el.title = `${e.rot} · ${e.mov} · Fonte: ${nv.fonte}`;
  }

  function conexao() {
    const fila = GG.backend.filaTamanho(), el = GG.$("#chip-rede");
    el.className = "rede" + (navigator.onLine ? "" : " off");
    el.textContent = navigator.onLine ? (fila ? `${fila} marcação(ões) esperando envio` : "") : `Sem internet${fila ? ` · ${fila} guardada(s)` : ""}`;
  }

  // Acesso da equipe (Defesa Civil, voluntários). Cidadão não faz login: marca, pede socorro e cobra sem conta.
  function acessoEquipe() {
    const box = GG.$("#acesso-equipe");
    if (!box) return;
    if (!GG.backend.temAcessoEquipe()) { box.innerHTML = ""; return; }
    const s = GG.backend.sessao(), equipe = GG.backend.papel() === "autoridade";
    if (s) {
      box.innerHTML = `<div class="cob-contagem"><span>${equipe ? "Você entrou como <b>equipe</b>" : "Você entrou, mas este e-mail ainda não está na equipe"}: ${GG.esc(s.email)}</span>
        <button class="btn" id="eq-sair">Sair</button></div>`;
      GG.$("#eq-sair").onclick = async () => { await GG.backend.sair(); GG.toast("Você saiu. O app continua funcionando normalmente."); };
      return;
    }
    box.innerHTML = `<details class="card"><summary>Sou da equipe (Defesa Civil, Bombeiros, voluntário)</summary>
      <p class="mut">Quem mora na cidade não precisa entrar: marca, pede socorro e cobra sem conta. Esta entrada é só para quem valida e atende.</p>
      <label class="campo">Seu e-mail<input type="text" id="eq-email" inputmode="email" autocomplete="email" placeholder="nome@exemplo.com"></label>
      <button class="btn primario" id="eq-entrar">Receber link de acesso</button>
      <p class="mut peq">Chega um e-mail com um link. Toque nele neste mesmo celular. Funciona só para e-mails cadastrados pela coordenação.</p></details>`;
    GG.$("#eq-entrar").onclick = async () => {
      const email = GG.$("#eq-email").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return GG.toast("Confira o e-mail.", "erro");
      try { await GG.backend.entrar(email); GG.toast("Link enviado. Abra o e-mail neste celular e toque no link."); }
      catch (e) { GG.toast(e.message, "erro"); }
    };
  }
  function avisoAcesso() {
    if (!GG.acessoRecente) return;
    GG.toast(GG.acessoRecente === "ok" ? (GG.backend.papel() === "autoridade" ? "Pronto: você entrou como equipe." : "Você entrou, mas este e-mail ainda não está na equipe.") : "O link de acesso expirou ou já foi usado. Peça outro.", GG.acessoRecente === "ok" ? "ok" : "erro");
    GG.acessoRecente = null;
  }

  function acessibilidade() {
    const root = document.documentElement;
    const cfg = GG.store.get("a11y", { escala: 1, contraste: false, tema: null });
    const aplicar = () => {
      root.style.setProperty("--escala", cfg.escala);
      root.classList.toggle("alto-contraste", cfg.contraste);
      root.dataset.theme = cfg.tema || "light"; // claro por padrão: mais legível para quem enxerga pouco
      GG.$("#btn-letra").textContent = cfg.escala >= 1.3 ? "A+++" : cfg.escala >= 1.15 ? "A++" : "A+";
      GG.store.set("a11y", cfg);
      setTimeout(() => GG.mapa.resize(), 50);
    };
    GG.$("#btn-letra").onclick = () => { cfg.escala = cfg.escala >= 1.3 ? 1 : cfg.escala >= 1.15 ? 1.3 : 1.15; aplicar(); };
    GG.$("#cfg-contraste").checked = cfg.contraste;
    GG.$("#cfg-contraste").onchange = (e) => { cfg.contraste = e.target.checked; aplicar(); };
    GG.$("#cfg-tema").value = cfg.tema || "light";
    GG.$("#cfg-tema").onchange = (e) => { cfg.tema = e.target.value || null; aplicar(); };
    aplicar();
  }

  async function iniciar() {
    GG.$$("[data-ic]").forEach((el) => { el.innerHTML = GG.ic(el.dataset.ic, +el.dataset.tam || 24); });
    acessibilidade();
    GG.voz.iniciar();
    document.addEventListener("click", (e) => {
      const n = e.target.closest("[data-nav]");
      if (n) { e.preventDefault(); GG.ir(n.dataset.nav); return; }
      if (e.target.closest("[data-simular]")) { e.preventDefault(); GG.ir("simular"); return; }
      const r = e.target.closest("[data-relatar]");
      if (r) { e.preventDefault(); GG.relatar.abrir(r.dataset.relatar ? { tipo: r.dataset.relatar } : {}); }
    });
    GG.$("#folha-mais").addEventListener("click", (e) => { if (e.target.id === "folha-mais" || e.target.closest("[data-fechar]")) GG.$("#folha-mais").hidden = true; });
    addEventListener("hashchange", () => GG.ir(location.hash.slice(1)));
    addEventListener("online", conexao); addEventListener("offline", conexao);
    GG.on("fila", conexao);
    GG.on("backend", (b) => { conexao(); GG.$("#cfg-papel").textContent = b.papel === "autoridade" ? "Equipe (pode atualizar e ver dados de resgate)" : "Cidadão"; acessoEquipe(); avisoAcesso(); });
    GG.on("nivel", statusNivel);

    GG.relatar.iniciar();
    GG.mapa.iniciar();
    GG.simulador.iniciar();
    GG.morro.iniciar();
    GG.vergonha.iniciar();
    GG.cobrar.iniciar();
    GG.compartilhar.iniciar();
    GG.instalar.iniciar();
    GG.$("#mais-instalar").onclick = () => { GG.$("#folha-mais").hidden = true; GG.instalar.abrir(); };
    GG.resgate.iniciar();
    await GG.live.carregarNivel();
    GG.casa.iniciar();
    GG.guia.iniciar();
    GG.inicio.iniciar();
    GG.backend.iniciar();
    setInterval(() => GG.live.carregarNivel(), 10 * 60 * 1000);
    GG.ir(location.hash.slice(1) || "inicio");
    conexao();
    if ("serviceWorker" in navigator && !window.claude?.use && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", iniciar) : iniciar();
})();
