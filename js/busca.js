/* GuGa · busca de endereço enquanto a pessoa digita. "rua dr barcel 123" → "Rua Doutor Barcelos, 123".
   Tudo no aparelho, sem mandar o que se digita para ninguém: índice de ruas e números do IBGE (CNEFE 2022),
   abreviações (dr, av, gal, cel, pres, n sra…), acentos e um erro de digitação por palavra. Funciona sem internet depois da 1ª vez. */
GG.busca = (() => {
  let indice = null, carregando = null;
  const chunks = {};
  const ABREV = {
    r: "rua", av: "avenida", avda: "avenida", tv: "travessa", trav: "travessa", al: "alameda", est: "estrada", estr: "estrada",
    pc: "praca", pca: "praca", lgo: "largo", lg: "largo", rod: "rodovia", vl: "vila", ac: "acesso",
    dr: "doutor", dra: "doutora", gal: "general", gen: "general", cel: "coronel", cap: "capitao", ten: "tenente", sgt: "sargento",
    mal: "marechal", brig: "brigadeiro", alm: "almirante", pres: "presidente", prof: "professor", profa: "professora", eng: "engenheiro",
    des: "desembargador", sen: "senador", dep: "deputado", ver: "vereador", gov: "governador", min: "ministro", pe: "padre", fr: "frei",
    sta: "santa", sto: "santo", ns: "nossa", nsa: "nossa", n: "nossa", s: "sao", sra: "senhora", sr: "senhor", cons: "conselheiro", visc: "visconde", cde: "conde",
  };
  const TIPOS = new Set(["rua", "avenida", "travessa", "alameda", "estrada", "praca", "largo", "rodovia", "beco", "acesso", "vila", "passagem", "viela", "caminho", "escadaria", "viaduto", "loteamento", "parque"]);
  const VAZIAS = new Set(["da", "de", "do", "das", "dos", "e", "d"]);

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  // números por extenso e romanos viram algarismos dos dois lados: "vinte e quatro de outubro" = "24 de outubro", "xv" = "15"
  const UN = { um: 1, uma: 1, primeiro: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
    treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
  const DZ = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
  const ROM = { ii: 2, iii: 3, iv: 4, vi: 6, vii: 7, viii: 8, ix: 9, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 };
  function numerizar(ts) {
    const out = [];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (DZ[t] != null && ts[i + 1] === "e" && UN[ts[i + 2]] != null && UN[ts[i + 2]] < 10) { out.push(String(DZ[t] + UN[ts[i + 2]])); i += 2; }
      else if (DZ[t] != null) out.push(String(DZ[t]));
      else if (UN[t] != null && i > 0) out.push(String(UN[t])); // "Rua Um" sim; "uma" no começo da busca não
      else if (ROM[t] != null && i > 0) out.push(String(ROM[t]));
      else out.push(t);
    }
    return out;
  }
  const tokens = (s) => numerizar(norm(s).split(" ").filter(Boolean));

  function preparar(j) {
    return j.ruas.map(([nome, bairros, chunk, min, max, qtd, lon, lat, chave]) => {
      const ts = tokens(nome).map((t) => ABREV[t] || t).filter((t) => !VAZIAS.has(t));
      return { nome, bairros, chunk, min, max, qtd, lon, lat, ts, chave: chave || nome };
    });
  }

  async function carregar() {
    if (indice) return indice;
    carregando ||= fetch("data/ruas.json").then((r) => r.ok ? r.json() : Promise.reject(new Error("sem índice"))).then((j) => (indice = preparar(j)));
    try { return await carregando; } catch { carregando = null; return null; }
  }

  // distância de edição com limite (para "barcleos" achar "barcelos")
  function perto(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    if (i === a.length && i === b.length) return true;
    const resto = (x, y) => x.slice(i + 1) === y.slice(i + 1) || x.slice(i + 1) === y.slice(i) || x.slice(i) === y.slice(i + 1)
      || (x[i] === y[i + 1] && x[i + 1] === y[i] && x.slice(i + 2) === y.slice(i + 2));
    return resto(a, b);
  }

  /** nota de 0 (não serve) para cima: cada palavra digitada precisa casar com uma palavra do nome. */
  function nota(rua, qs) {
    let total = 0, usados = new Set(), ordem = -1, emOrdem = true;
    for (let k = 0; k < qs.length; k++) {
      const { alts, ultima, tipo } = qs[k];
      let melhor = 0, pos = -1;
      rua.ts.forEach((t, j) => {
        if (usados.has(j)) return;
        for (const q of alts) {
          let n = 0;
          if (t === q) n = 4;
          else if (t.startsWith(q) && (ultima || q.length >= 3)) n = 3;
          else if (q.length >= 4 && (perto(q, t) || perto(q, t.slice(0, q.length)))) n = 1.5;
          if (n > melhor) { melhor = n; pos = j; }
        }
      });
      if (!melhor) { if (tipo) { total -= 1; continue; } return 0; } // "rua" digitado numa avenida: só perde um pouco
      usados.add(pos); total += melhor;
      if (pos < ordem) emOrdem = false; ordem = pos;
    }
    if (!total) return 0;
    return total + (emOrdem ? 1 : 0) + Math.min(1.5, Math.log10(rua.qtd + 1) / 2) - rua.ts.length * 0.05;
  }

  /** separa "rua dr barcelos, 123" em texto da rua e número */
  function separar(q) {
    const m = q.match(/^(.*?)[\s,]+(?:n[ºo°.]?\s*)?(\d{1,5})\s*[a-z]?\s*$/i);
    return m && m[1].trim().length >= 2 ? { rua: m[1], num: +m[2] } : { rua: q, num: null };
  }

  async function sugerir(q, max = 6) {
    const idx = await carregar();
    if (!idx) return null;
    const { rua, num } = separar(q);
    const ts = tokens(rua).filter((t) => !VAZIAS.has(t));
    if (!ts.length || (ts.length === 1 && ts[0].length < 2)) return { itens: [], num };
    const qs = ts.map((t, i) => ({ alts: [...new Set([t, ABREV[t]].filter(Boolean))], ultima: i === ts.length - 1, tipo: TIPOS.has(ABREV[t] || t) }));
    const achados = [];
    for (const r of idx) { const n = nota(r, qs); if (n > 0) achados.push([n + (num && num >= r.min && num <= r.max ? 1 : 0), r]); }
    achados.sort((a, b) => b[0] - a[0] || b[1].qtd - a[1].qtd);
    return { itens: achados.slice(0, max).map((a) => a[1]), num };
  }

  async function numeros(rua) {
    chunks[rua.chunk] ||= fetch(`data/enderecos/${String(rua.chunk).padStart(2, "0")}.json`).then((r) => r.json());
    const d = await chunks[rua.chunk], plano = d[rua.chave] || [], out = [];
    let n = 0, x = 0, y = 0;
    for (let i = 0; i < plano.length; i += 3) { n += plano[i]; x += plano[i + 1]; y += plano[i + 2]; out.push([n, x / 1e5, y / 1e5]); }
    return out;
  }

  /** ponto do número: exato quando o IBGE tem; senão, entre os vizinhos do mesmo lado da rua (par/ímpar) */
  async function localizar(rua, num) {
    const ns = await numeros(rua);
    if (!ns.length) return { lon: rua.lon, lat: rua.lat, tipo: "rua" };
    if (!num) return { lon: rua.lon, lat: rua.lat, tipo: "rua" };
    const ex = ns.find((p) => p[0] === num);
    if (ex) return { lon: ex[1], lat: ex[2], tipo: "exato" };
    const lado = ns.filter((p) => p[0] % 2 === num % 2), base = lado.length ? lado : ns;
    let abaixo = null, acima = null;
    for (const p of base) { if (p[0] < num) abaixo = p; else if (p[0] > num && !acima) acima = p; }
    if (abaixo && acima) {
      const f = (num - abaixo[0]) / (acima[0] - abaixo[0]);
      return { lon: abaixo[1] + (acima[1] - abaixo[1]) * f, lat: abaixo[2] + (acima[2] - abaixo[2]) * f, tipo: "entre", de: abaixo[0], ate: acima[0] };
    }
    const p = abaixo || acima;
    return { lon: p[1], lat: p[2], tipo: "perto", de: p[0] };
  }

  // ── interface: lista que aparece embaixo do campo ─────────────────────
  function ligar(input, lista, aoEscolher) {
    let itens = [], ativo = -1, numAtual = null, seq = 0;
    input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-controls", lista.id); input.setAttribute("aria-expanded", "false");
    lista.setAttribute("role", "listbox");
    const destacar = (nome, q) => {
      const qs = tokens(separar(q).rua).map((t) => [t, ABREV[t]]).flat().filter(Boolean);
      return nome.split(" ").map((p) => {
        const np = norm(p), hit = qs.find((t) => t.length >= 1 && np.startsWith(t));
        return hit ? `<mark>${GG.esc(p.slice(0, hit.length))}</mark>${GG.esc(p.slice(hit.length))}` : GG.esc(p);
      }).join(" ");
    };
    async function atualizar() {
      const q = input.value, eu = ++seq;
      if (q.trim().length < 2) { fechar(); return; }
      const r = await sugerir(q);
      if (eu !== seq) return;
      if (!r) { fechar(); return; } // sem índice: a busca normal (botão Buscar) continua valendo
      itens = r.itens; numAtual = r.num; ativo = itens.length ? 0 : -1;
      if (!itens.length) { lista.innerHTML = `<p class="mut busca-vazia">Nenhuma rua com esse nome em Porto Alegre. Confira a escrita ou toque em Buscar.</p>`; lista.hidden = false; return; }
      lista.innerHTML = itens.map((x, i) => `<button type="button" role="option" id="${lista.id}-${i}" class="sug" aria-selected="${i === ativo}" data-i="${i}">${GG.ic("alfinete", 24)}<span>
        <b>${destacar(x.nome, q)}${numAtual ? `, ${numAtual}` : ""}</b>
        <small>${GG.esc(x.bairros.slice(0, 2).join(", ") || "Porto Alegre")} · ${numAtual ? (numAtual < x.min || numAtual > x.max ? `números de ${x.min} a ${x.max}` : "toque para ver a sua casa") : `números de ${x.min} a ${x.max}`}</small></span></button>`).join("");
      lista.insertAdjacentHTML("beforeend", `<small class="busca-fonte">Endereços: IBGE, CNEFE 2022 · busca feita no seu celular</small>`);
      lista.hidden = false; input.setAttribute("aria-expanded", "true");
      if (ativo >= 0) input.setAttribute("aria-activedescendant", `${lista.id}-${ativo}`);
      GG.$$(".sug", lista).forEach((b) => b.onclick = () => escolher(+b.dataset.i));
    }
    function fechar() { lista.hidden = true; lista.innerHTML = ""; itens = []; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
    async function escolher(i) {
      const rua = itens[i]; if (!rua) return;
      if (!numAtual) { // falta o número: completa o nome e pede o número
        input.value = rua.nome + ", "; input.focus();
        fechar();
        GG.toast("Agora digite o número da casa.");
        return;
      }
      fechar();
      const p = await localizar(rua, numAtual);
      input.value = `${rua.nome}, ${numAtual}`;
      aoEscolher({ ...p, rua, num: numAtual, rotulo: `${rua.nome}, ${numAtual}` });
    }
    let t = null;
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(atualizar, 70); });
    input.addEventListener("focus", () => { carregar(); if (input.value.trim().length >= 2) atualizar(); });
    input.addEventListener("keydown", (e) => {
      if (lista.hidden || !itens.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); ativo = (ativo + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length;
        GG.$$(".sug", lista).forEach((b, j) => b.setAttribute("aria-selected", String(j === ativo)));
        input.setAttribute("aria-activedescendant", `${lista.id}-${ativo}`);
      } else if (e.key === "Enter" && ativo >= 0) { e.preventDefault(); escolher(ativo); }
      else if (e.key === "Escape") fechar();
    });
    return { primeiro: async () => { const r = await sugerir(input.value, 1); return r?.itens[0] ? { rua: r.itens[0], num: r.num } : null; } };
  }

  return { carregar, sugerir, localizar, ligar, separar, _norm: norm };
})();
