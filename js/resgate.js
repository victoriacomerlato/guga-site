/* GuGa · Fila de resgate: pedidos de socorro por prioridade, com o motivo de cada posição. */
GG.resgate = (() => {
  const M = GG.modelo;

  function render() {
    const reais = GG.backend.relatos().filter((r) => r.status !== "rejeitado");
    const demo = reais.length === 0, lista = demo ? M.exemplos() : reais;
    const equipe = GG.backend.papel() === "autoridade";
    const fila = lista.filter((r) => (r.tipo === "sos" || r.tipo === "animais") && M.ativo(r))
      .map((r) => ({ r, p: M.prioridade(r) })).sort((a, b) => b.p.total - a.p.total);
    const rev = lista.filter((r) => r.status === "aberto" && r.tipo !== "sos" && r.tipo !== "animais");
    GG.$("#painel-resgate").innerHTML = `
      ${demo ? `<p class="demo-faixa">Exemplos fictícios. Ainda não há pedidos reais.</p>` : ""}
      <p class="mut">${equipe ? "Você está como equipe: vê o ponto exato e o telefone." : "Para proteger quem pediu ajuda, o público vê o local aproximado e sem telefone."}</p>
      <div class="fila-sos">${fila.map(({ r, p }, i) => {
        const fx = M.faixaPrioridade(p.total), s = r.sos || {};
        return `<div class="sos-item"><div class="pont ${fx.cls}">${p.total}<small>${fx.rot}</small></div><div class="pilha" style="gap:6px">
          <b style="font-size:1.08rem">${i + 1}º · ${r.tipo === "sos" ? `${s.pessoas || 1} pessoa(s)` : `${s.animais || 1} animal(is)`} · ${GG.esc(r.bairro || r.cidade || "")}</b>
          <p class="mut">${GG.tempo(r.criadoEm)} · água ${GG.esc((M.AGUA.find((a) => a.id === s.agua)?.rotulo || "?").toLowerCase())}${s.criancas ? ` · ${s.criancas} criança(s)` : ""}${s.idosos ? ` · ${s.idosos} idoso(s)` : ""}${s.pcd ? " · acamado" : ""}${s.especies?.length ? ` · ${GG.esc(s.especies.join(", "))}` : ""}</p>
          ${r.descricao && equipe ? `<p>${GG.esc(r.descricao)}</p>` : ""}
          <details class="porque"><summary>Por que está nesta posição</summary><ul>${p.partes.map(([t, v]) => `<li>${GG.esc(t)}: +${v}</li>`).join("")}</ul></details>
          <div class="linha">
            <button class="btn" data-ver="${r.id}">Ver no mapa</button>
            ${equipe && !r.demo ? `<button class="btn" data-st="em_atendimento" data-id="${r.id}">Equipe a caminho</button><button class="btn primario" data-st="resolvido" data-id="${r.id}">Resgatado</button><button class="btn" data-tel="${r.id}">Telefone</button>` : ""}
          </div><div id="tel-${r.id}"></div></div></div>`;
      }).join("") || `<p class="mut">Nenhum pedido de socorro agora.</p>`}</div>
      ${equipe ? `<h3>Revisar marcações · ${rev.length}</h3><div class="lista-relatos">${rev.slice(0, 40).map((r) => `<div class="item-relato" style="grid-template-columns:1fr auto;cursor:default"><span><b>${GG.esc(M.TIPOS[r.tipo]?.subs[r.sub]?.rotulo)}</b><br><span class="mut">${GG.esc(r.bairro || "")} · ${GG.tempo(r.criadoEm)} · ${(r.fotos || []).length} foto(s)</span></span>
        <span class="linha">${r.demo ? `<span class="tag demo">exemplo</span>` : `<button class="btn" data-st="verificado" data-id="${r.id}">Confere</button><button class="btn" data-st="rejeitado" data-id="${r.id}">Falso</button>`}</span></div>`).join("") || `<p class="mut">Nada para revisar.</p>`}</div>` : ""}
      <details class="card"><summary>Como a prioridade é calculada</summary>
        <div class="rolar"><table class="tabela"><tbody>
          <tr><td>Pedido de resgate de pessoas</td><td class="n">+50</td></tr><tr><td>Cada pessoa (até 10)</td><td class="n">+4</td></tr>
          <tr><td>Bebê ou criança</td><td class="n">+20</td></tr><tr><td>Idoso</td><td class="n">+20</td></tr><tr><td>Acamado, deficiência ou doente</td><td class="n">+25</td></tr>
          <tr><td>Gestante</td><td class="n">+15</td></tr><tr><td>Falta remédio essencial</td><td class="n">+10</td></tr>
          <tr><td>Água na canela / joelho / cintura / peito / telhado</td><td class="n">+5 / 12 / 22 / 32 / 45</td></tr>
          <tr><td>Cada hora esperando (até 15 h)</td><td class="n">+2</td></tr><tr><td>Cada vizinho que confirma (até 5)</td><td class="n">+2</td></tr>
          <tr><td>Só animais</td><td class="n">+15 e +2 por animal</td></tr>
        </tbody></table></div>
        <p class="mut peq">Pesos iniciais, a calibrar com a Defesa Civil e os Bombeiros.</p></details>`;
    GG.$$("[data-ver]").forEach((b) => b.onclick = () => { GG.ir("mapa"); setTimeout(() => GG.mapa.abrirRelato(b.dataset.ver, true), 350); });
    GG.$$("#painel-resgate [data-st]").forEach((b) => b.onclick = async () => { try { await GG.backend.atualizar(b.dataset.id, { status: b.dataset.st }); GG.toast("Atualizado."); } catch (e) { GG.toast(e.message, "erro"); } });
    GG.$$("[data-tel]").forEach((b) => b.onclick = async () => { const p = await GG.backend.lerPrivado(b.dataset.tel).catch(() => null); GG.$("#tel-" + b.dataset.tel).innerHTML = `<p class="mono" style="font-size:1.2rem;user-select:all">${GG.esc(p?.contato || "Sem telefone informado")}</p>`; });
  }

  function iniciar() { GG.backend.ouvir(() => !GG.$("#v-resgate").hidden && render()); }
  return { iniciar, render };
})();
