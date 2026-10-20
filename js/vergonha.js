/* GuGa · De Olho na Rua: o que a população marcou e ninguém resolveu, com foto, dias de espera e o que o poder público prometeu. */
GG.vergonha = (() => {
  const M = GG.modelo;
  let filtro = "abertos", situacao = null;
  const CAM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>`;

  const dias = (r) => Math.max(0, Math.floor(((r.resolvidoEm ? new Date(r.resolvidoEm) : Date.now()) - new Date(r.criadoEm)) / 864e5));
  const eProblema = (r) => r.tipo === "bueiro" ? r.sub !== "ok" : r.tipo === "situacao" && ["inundando", "inundado", "inseguro"].includes(r.sub);

  function dados() {
    const reais = GG.backend.relatos().filter((r) => r.status !== "rejeitado");
    const demo = reais.length === 0;
    return { demo, lista: (demo ? M.exemplos() : reais).filter(eProblema) };
  }

  function card(r) {
    const d = dias(r), ok = r.status === "resolvido";
    const foto = r.fotos?.[0]?.url;
    const titulo = M.TIPOS[r.tipo]?.subs[r.sub]?.rotulo || "Problema";
    return `<article class="vg">
      <div class="foto">${foto ? `<img src="${GG.esc(foto)}" alt="Foto de ${GG.esc(titulo.toLowerCase())}" loading="lazy">` : `<span class="sem-foto">${CAM}<span>Sem foto</span></span>`}
        <span class="dias ${ok ? "ok" : ""}">${ok ? `Resolvido em ${d} dia${d === 1 ? "" : "s"}` : d === 0 ? "Marcado hoje" : `Há ${d} dia${d === 1 ? "" : "s"}`}</span>
        ${r.demo ? `<span class="exemplo">Exemplo</span>` : ""}</div>
      <div class="corpo">
        <h3>${GG.esc(titulo)}</h3>
        <p class="mut">${GG.esc(r.bairro || r.cidade || "")}${r.descricao ? ` · ${GG.esc(r.descricao.slice(0, 90))}` : ""}</p>
        <p class="peq">${r.confirmacoes ? `<b>${r.confirmacoes}</b> vizinho${r.confirmacoes === 1 ? "" : "s"} confirmaram` : "Ninguém confirmou ainda"}</p>
        ${r.cobrancas ? `<p class="peq"><b>${r.cobrancas}</b> ${r.cobrancas === 1 ? "cobrança enviada" : "cobranças enviadas"} à Prefeitura e ao Estado</p>` : ""}
        ${(r.protocolos || []).slice(-1).map((p) => `<p class="protocolo">Protocolo ${p.orgao === "estado" ? "do Estado" : "da Prefeitura"} nº <b>${GG.esc(p.numero)}</b>, aberto ${GG.tempo(p.em)}</p>`).join("")}
        ${!ok && r.conserto ? `<p class="tag warn" style="justify-self:start">Avisaram que foi arrumado · esperando validação</p>` : ""}
        <div class="acoes">
          ${!ok && !r.demo ? `<button class="btn" data-conf="${r.id}">Eu também vi</button>` : ""}
          ${!foto && !r.demo ? `<label class="btn marrom" style="cursor:pointer">Mandar foto<input type="file" accept="image/*" capture="environment" class="sr" data-foto="${r.id}"></label>` : ""}
          ${!ok ? `<button class="btn primario" data-cobrar="${r.id}">Cobrar</button>` : `<button class="btn" data-share="${r.id}">Compartilhar</button>`}
          ${!ok && r.demo && !r.conserto ? `<button class="btn" style="flex-basis:100%;border-color:var(--accent);color:var(--accent)" data-demo-arrumado>Foi arrumado</button>` : ""}
          ${!ok && !r.demo && !r.conserto ? `<label class="btn" style="cursor:pointer;flex-basis:100%;border-color:var(--accent);color:var(--accent)">Foi arrumado<input type="file" accept="image/*" capture="environment" class="sr" data-arrumado="${r.id}"></label>` : ""}
        </div>
      </div></article>`;
  }

  async function render() {
    const el = GG.$("#vergonha");
    const { demo, lista } = dados();
    const abertos = lista.filter((r) => r.status !== "resolvido");
    const maisVelho = abertos.reduce((m, r) => Math.max(m, dias(r)), 0);
    const bairros = new Set(abertos.map((r) => r.bairro || r.cidade)).size;
    const mostrar = lista.filter((r) => filtro === "abertos" ? r.status !== "resolvido" : filtro === "bueiros" ? r.tipo === "bueiro" && r.status !== "resolvido" : filtro === "alagamentos" ? r.tipo === "situacao" && r.status !== "resolvido" : r.status === "resolvido")
      .sort((a, b) => dias(b) - dias(a) || (b.confirmacoes || 0) - (a.confirmacoes || 0));
    // ranking: soma de dias de espera por bairro
    const porB = {};
    abertos.forEach((r) => { const b = r.bairro || r.cidade || "Sem bairro"; porB[b] ??= { n: 0, dias: 0 }; porB[b].n++; porB[b].dias += dias(r); });
    const rank = Object.entries(porB).sort((a, b) => b[1].dias - a[1].dias || b[1].n - a[1].n).slice(0, 6);
    const maxD = Math.max(1, ...rank.map(([, v]) => v.dias));
    if (!situacao) situacao = await fetch("data/situacao_atual.json").then((r) => r.json()).catch(() => null);
    const hoje = new Date().toISOString().slice(0, 10);
    const mesAno = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");

    el.innerHTML = `
      <div class="vergonha-topo">
        <span class="faixa"><span>Transparência</span></span>
        <h2>De Olho na Rua</h2>
        <p style="font-size:1.1rem;max-width:56ch">Bueiros entupidos e pontos de alagamento que a população marcou, e há quantos dias cada um espera solução. À vista de todos.</p>
        <div class="numeros">
          <div><b>${abertos.length}</b><span>sem solução</span></div>
          <div><b>${maisVelho}</b><span>dias, o mais antigo</span></div>
          <div><b>${bairros}</b><span>bairros</span></div>
        </div>
        <div class="linha"><button class="btn primario grande" data-relatar="bueiro" style="max-width:420px">Marcar um lugar com foto</button></div>
        ${demo ? `<p class="demo-faixa">Os cartões abaixo são exemplos fictícios. Somem quando chegar a primeira marcação real.</p>` : ""}
      </div>
      ${GG.backend.papel() === "autoridade" ? validacao(lista) : ""}
      <div class="filtro-chips" role="group" aria-label="Filtrar">
        ${[["abertos", "Sem solução"], ["bueiros", "Bueiros"], ["alagamentos", "Alagamentos"], ["resolvidos", "Resolvidos"]].map(([k, r]) => `<button aria-pressed="${filtro === k}" data-filtro="${k}">${r}</button>`).join("")}
      </div>
      <div class="mural">${mostrar.map(card).join("") || `<p class="mut">Nada aqui. Viu um bueiro entupido? Marque com foto.</p>`}</div>
      <div class="grade">
        <div class="card"><h3>Bairros mais esquecidos</h3>
          <div class="ranking">${rank.map(([b, v], i) => `<div class="lin"><span class="pos">${i + 1}</span><span><b>${GG.esc(b)}</b><div class="barra-v"><i style="width:${v.dias / maxD * 100}%"></i></div></span><span class="mono">${v.dias} dia${v.dias === 1 ? "" : "s"}</span></div>`).join("") || `<p class="mut">Sem dados ainda.</p>`}</div>
          <p class="mut peq">Soma dos dias de espera de tudo que está aberto no bairro.</p></div>
        <div class="card"><h3>O que o poder público fez e prometeu</h3>
          <div class="fatos">${(situacao?.fatos || []).map((f) => {
            const vencido = f.prazo && f.prazo < hoje;
            const cls = f.tipo === "feito" ? "feito" : f.tipo === "prazo" && !vencido ? "prazo" : "";
            return `<div class="fato ${cls}"><div><h4>${GG.esc(f.titulo)}</h4><p>${GG.esc(f.texto)}${f.prazo ? ` <b style="color:${vencido ? "var(--crit)" : "var(--warn)"}">Prazo: ${mesAno(f.prazo)}${vencido ? ". Venceu. Ficou pronto?" : ""}</b>` : ""}</p>
              <a class="fonte" href="${GG.esc(f.url)}" target="_blank" rel="noopener">${GG.esc(f.fonte)} · ${mesAno(f.data)}</a></div></div>`;
          }).join("")}</div></div>
      </div>
      <details class="card"><summary>Cobrar pelo bairro inteiro</summary>
        <label class="campo">Bairro<select id="cobrar-bairro">${[...new Set(lista.map((r) => r.bairro || r.cidade).filter(Boolean))].sort().map((b) => `<option>${GG.esc(b)}</option>`).join("")}</select></label>
        <div id="cobrar-txt" class="pilha"></div></details>
      <details class="card"><summary>Baixar todos os dados</summary>
        <p>Marcações públicas, sem dados pessoais. Para jornalistas, pesquisadores e vereadores.</p>
        <div class="linha"><button class="btn" id="exp-csv">Planilha (CSV)</button><button class="btn" id="exp-geo">Mapa (GeoJSON)</button></div>
        <p class="mut peq">Fontes: população (GuGa), DMAE, IPH/UFRGS (CC BY 4.0), imprensa. Atualizado em ${situacao ? new Date(situacao.atualizado + "T12:00:00").toLocaleDateString("pt-BR") : "—"}.</p></details>
      <p class="assinatura">powered by <b>Fortsy Tech Solutions</b></p>`;

    GG.$$("[data-arrumado]", el).forEach((inp) => {
      inp.onclick = (e) => { if (!confirmaArrumado(inp)) e.preventDefault(); };
      inp.onchange = async () => {
        try { const f = inp.files[0], b = f ? (await GG.relatar.reduzirFoto(f)).blob : null; await GG.backend.pedirConserto(inp.dataset.arrumado, b); GG.toast("Obrigado! A equipe GuGa vai conferir antes de marcar como resolvido."); }
        catch (e) { GG.toast("Não deu para enviar: " + e.message, "erro"); }
      };
    });
    GG.$$("[data-demo-arrumado]", el).forEach((b) => b.onclick = () => GG.toast("Cartão de exemplo. Numa marcação real, este botão avisa a equipe, que confere antes de dar como resolvido."));
    GG.$$("[data-validar]", el).forEach((b) => b.onclick = async () => {
      try { await GG.backend.validarConserto(b.dataset.validar, b.dataset.ok === "1"); GG.toast(b.dataset.ok === "1" ? "Validado: marcado como resolvido." : "Mantido em aberto."); } catch (e) { GG.toast(e.message, "erro"); }
    });
    GG.$$("[data-filtro]", el).forEach((b) => b.onclick = () => { filtro = b.dataset.filtro; render(); });
    GG.$$("[data-conf]", el).forEach((b) => b.onclick = async () => { try { await GG.backend.confirmar(b.dataset.conf); GG.toast("Obrigado. Sua confirmação conta."); } catch (e) { GG.toast(e.message, "erro"); } });
    GG.$$("[data-share]", el).forEach((b) => b.onclick = () => compartilhar(lista.find((r) => r.id === b.dataset.share)));
    GG.$$("[data-cobrar]", el).forEach((b) => b.onclick = () => GG.cobrar.abrir({ relato: lista.find((r) => r.id === b.dataset.cobrar) }));
    GG.$$("[data-foto]", el).forEach((inp) => inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try { const { blob } = await GG.relatar.reduzirFoto(f); await GG.backend.adicionarFoto(inp.dataset.foto, blob); GG.toast("Foto enviada. Obrigado!"); }
      catch (e) { GG.toast("Não deu para enviar a foto: " + e.message, "erro"); }
    });
    const sb = GG.$("#cobrar-bairro", el);
    const cobrar = () => {
      const b = sb.value, rs = abertos.filter((r) => (r.bairro || r.cidade) === b);
      const bue = rs.filter((r) => r.tipo === "bueiro"), velho = rs.reduce((m, r) => Math.max(m, dias(r)), 0);
      const txt = `No bairro ${b}, moradores marcaram ${rs.length} problema(s) sem solução no De Olho na Rua, do GuGa${bue.length ? `, entre eles ${bue.length} bueiro(s) entupido(s)` : ""}. O mais antigo espera há ${velho} dia(s).\n\nPedimos: limpeza dos bueiros marcados, prazo público para cada um e o calendário de limpeza do bairro antes das próximas chuvas.${demo ? "\n\n[EXEMPLO: números fictícios, não envie]" : ""}`;
      const lai = `PEDIDO DE ACESSO À INFORMAÇÃO (Lei 12.527/2011)\n\nSolicito:\n1. Cronograma de limpeza de bocas de lobo e redes pluviais do bairro ${b} nos últimos 12 meses e nos próximos 6 meses.\n2. Situação atual das casas de bombas que atendem o bairro ${b}: capacidade, gerador e data da última manutenção.\n3. Plano de contingência da prefeitura para cheias do Guaíba acima de 3,00 m.`;
      GG.$("#cobrar-txt").innerHTML = `<div class="zap-msg">${GG.esc(txt)}</div><div class="linha"><button class="btn primario" id="cob-pref">Cobrar a Prefeitura</button><button class="btn" id="cob-est">Cobrar o Estado</button><button class="btn" id="lai-copiar">Copiar pedido pela Lei de Acesso</button></div>`;
      GG.$("#cob-pref").onclick = () => GG.cobrar.abrir({ texto: txt, bairro: b, alvo: "prefeitura" });
      GG.$("#cob-est").onclick = () => GG.cobrar.abrir({ texto: txt, bairro: b, alvo: "estado" });
      GG.$("#lai-copiar").onclick = () => GG.relatar.copiar(lai);
    };
    if (sb) { const casa = GG.casa.salva(); if (casa?.bairro && [...sb.options].some((o) => o.value === casa.bairro)) sb.value = casa.bairro; sb.onchange = cobrar; if (sb.value) cobrar(); }
    GG.$("#exp-csv", el).onclick = () => exportar("csv", lista);
    GG.$("#exp-geo", el).onclick = () => exportar("geojson", lista);
  }

  // "Foi arrumado" pede uma foto do conserto; quem não tiver foto pode mandar só o aviso
  function confirmaArrumado(inp) {
    if (inp.dataset.semFoto) return true;
    const card = inp.closest(".vg");
    if (card.querySelector(".pergunta-arrumado")) return true;
    const box = document.createElement("div");
    box.className = "pergunta-arrumado pilha";
    box.style.cssText = "flex-basis:100%;gap:8px";
    box.innerHTML = `<p class="peq">Tire uma foto do lugar arrumado. A equipe GuGa confere antes de marcar como resolvido.</p>
      <div class="linha"><button class="btn primario" data-a="foto">Tirar foto</button><button class="btn" data-a="sem">Avisar sem foto</button></div>`;
    inp.closest(".acoes").after(box);
    box.querySelector('[data-a="foto"]').onclick = () => inp.click();
    box.querySelector('[data-a="sem"]').onclick = async () => {
      try { await GG.backend.pedirConserto(inp.dataset.arrumado, null); GG.toast("Obrigado! A equipe GuGa vai conferir."); } catch (e) { GG.toast(e.message, "erro"); }
    };
    return false;
  }

  function validacao(lista) {
    const pend = lista.filter((r) => r.conserto && !r.conserto.validadoEm && r.status !== "resolvido");
    return `<div class="card borda" style="border-color:var(--accent)"><h3>Para validar · ${pend.length}</h3>
      <p class="mut peq">Moradores avisaram que estes lugares foram arrumados. Só você e a equipe veem esta parte.</p>
      ${pend.length ? pend.map((r) => `<div class="linha" style="justify-content:space-between;border-top:1px solid var(--line);padding-top:10px">
        <span style="display:flex;gap:12px;align-items:center">${r.conserto.foto?.url ? `<img src="${GG.esc(r.conserto.foto.url)}" alt="Foto do conserto" style="width:72px;height:72px;object-fit:cover;border-radius:8px">` : `<span class="tag mut">sem foto</span>`}
        <span><b>${GG.esc(M.TIPOS[r.tipo]?.subs[r.sub]?.rotulo || "")}</b><br><span class="mut peq">${GG.esc(r.bairro || "")} · aberto há ${dias(r)} dias · aviso ${GG.tempo(r.conserto.em)}</span></span></span>
        <span class="linha">${r.demo ? `<span class="tag demo">exemplo</span>` : `<button class="btn primario" data-validar="${r.id}" data-ok="1">Está arrumado</button><button class="btn" data-validar="${r.id}" data-ok="0">Não está</button>`}</span></div>`).join("") : `<p class="mut">Nada para validar agora.</p>`}</div>`;
  }

  function compartilhar(r) {
    if (!r) return;
    const d = dias(r), t = (M.TIPOS[r.tipo]?.subs[r.sub]?.rotulo || "Problema").toLowerCase();
    const txt = `De Olho na Rua · GuGa\n${t[0].toUpperCase() + t.slice(1)} em ${r.bairro || r.cidade}${r.descricao ? ` (${r.descricao.slice(0, 80)})` : ""}.\n${r.status === "resolvido" ? `Resolvido depois de ${d} dias.` : `Há ${d} dias sem solução.`} ${r.confirmacoes || 0} vizinhos confirmaram.\nPrefeitura, resolve! Reclame também no 156.`;
    open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank", "noopener");
  }

  function exportar(fmt, lista) {
    const rows = GG.backend.relatos().filter((r) => r.status !== "rejeitado").map((r) => {
      const sos = r.tipo === "sos" || r.tipo === "animais", q = (v) => sos ? Math.round(v / 0.0015) * 0.0015 : v;
      return { id: r.id, tipo: r.tipo, situacao: r.sub, status: r.status, bairro: r.bairro || "", cidade: r.cidade || "", lat: +q(r.lat).toFixed(5), lon: +q(r.lon).toFixed(5),
        criado_em: r.criadoEm, resolvido_em: r.resolvidoEm || "", dias: dias(r), confirmacoes: r.confirmacoes || 0, foto: r.fotos?.[0]?.url || "", descricao: sos ? "" : (r.descricao || "") };
    });
    if (!rows.length) return GG.toast("Ainda não há marcações reais para baixar.", "erro");
    if (fmt === "csv") {
      const cols = Object.keys(rows[0]);
      GG.baixar("guga-de-olho-na-rua.csv", "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n"), "text/csv");
    } else {
      GG.baixar("guga-de-olho-na-rua.geojson", JSON.stringify({ type: "FeatureCollection", features: rows.map((r) => ({ type: "Feature", geometry: { type: "Point", coordinates: [r.lon, r.lat] }, properties: r })) }), "application/geo+json");
    }
  }

  function iniciar() { GG.backend.ouvir(() => !GG.$("#v-vergonha").hidden && render()); }
  return { iniciar, render };
})();
