/* GuGa · backend com 3 adaptadores e fila offline.
 *  1. Supabase (produção): PostgREST + Storage, RLS no servidor.
 *  2. Banco do Artifact (prévia no claude.ai): db + assets + user.
 *  3. Local (sem servidor): só este aparelho.
 * Todo envio passa pela fila: sem internet, o relato fica guardado e sobe sozinho quando a conexão volta.
 */
GG.backend = (() => {
  let impl = null;
  const ouvintes = new Set();
  let relatos = [];
  let papel = "cidadao"; // cidadao | autoridade

  const notificar = () => ouvintes.forEach((fn) => fn(relatos));

  // ── Fila offline ────────────────────────────────────────────────
  const fila = {
    ler: () => GG.store.get("fila", []),
    gravar: (f) => GG.store.set("fila", f),
    add(item) { const f = this.ler(); f.push(item); this.gravar(f); GG.emit("fila", f.length); },
  };
  async function esvaziarFila() {
    if (!impl || !navigator.onLine) return;
    const f = fila.ler();
    if (!f.length) return;
    const resto = [];
    for (const item of f) {
      try {
        const fotos = [];
        for (const d of item.fotosDataUrl || []) fotos.push(await impl.subirFoto(await (await fetch(d)).blob()));
        await impl.criar({ ...item.relato, fotos: [...(item.relato.fotos || []), ...fotos], enviadoOffline: true });
      } catch { resto.push(item); }
    }
    fila.gravar(resto);
    GG.emit("fila", resto.length);
    if (f.length > resto.length) GG.toast(`${f.length - resto.length} relato(s) guardado(s) sem internet foram enviados.`);
  }
  addEventListener("online", esvaziarFila);

  // cada aparelho conta uma vez por canal (o servidor faz o mesmo com o hash de origem)
  function marcarCobranca(id, canal) {
    const k = `${id}:${canal}`, ja = GG.store.get("cobrados", []);
    if (ja.includes(k)) return false;
    GG.store.set("cobrados", [...ja, k].slice(-500)); return true;
  }
  function validarProtocolo(n) {
    const num = String(n || "").trim();
    if (num.length < 3 || num.length > 40 || !/^[A-Za-z0-9./ -]+$/.test(num)) throw new Error("Confira o número do protocolo: só letras, números, ponto, barra e traço.");
    return num;
  }

  // ── 1. Supabase ─────────────────────────────────────────────────
  function supabase(url, key) {
    // Sessão da equipe (Defesa Civil, voluntários). O cidadão nunca precisa entrar.
    const SES = "sessao_equipe";
    let ses = GG.store.get(SES, null);
    // volta do link de acesso enviado por e-mail: #access_token=...&refresh_token=...&expires_in=3600
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get("access_token")) {
      ses = { access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expira: Date.now() + (+h.get("expires_in") || 3600) * 1000 };
      GG.store.set(SES, ses); GG.acessoRecente = "ok";
      history.replaceState(null, "", location.pathname + location.search + "#inicio");
    } else if (h.get("error_description") || h.get("error")) {
      GG.acessoRecente = h.get("error_description") || h.get("error");
      history.replaceState(null, "", location.pathname + location.search + "#inicio");
    }
    async function token() {
      if (!ses) return key;
      if (Date.now() > ses.expira - 60000) {
        try {
          const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: ses.refresh_token }) });
          if (!r.ok) throw new Error();
          const j = await r.json();
          ses = { access_token: j.access_token, refresh_token: j.refresh_token, expira: Date.now() + j.expires_in * 1000, email: j.user?.email || ses.email };
          GG.store.set(SES, ses);
        } catch { ses = null; GG.store.set(SES, null); return key; }
      }
      return ses.access_token;
    }
    const rest = async (p, o = {}) => {
      const t = await token();
      let r = await fetch(`${url}/rest/v1/${p}`, { ...o, headers: { apikey: key, Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(o.headers || {}) } });
      // sessão vencida ou de outro projeto: esquece a sessão e tenta de novo como cidadão (os dados públicos não podem parar)
      if (r.status === 401 && ses && !p.startsWith("rpc/eh_equipe")) {
        ses = null; GG.store.set(SES, null);
        r = await fetch(`${url}/rest/v1/${p}`, { ...o, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(o.headers || {}) } });
      }
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `Servidor respondeu ${r.status}`); }
      return r.status === 204 ? null : r.json();
    };
    const map = (x) => ({ ...x, criadoEm: x.criado_em, resolvidoEm: x.resolvido_em, lon: x.lon, lat: x.lat });
    return {
      nome: "Servidor GuGa",
      async iniciar() {
        if (ses) {
          try {
            const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${await token()}` } }).then((r) => r.ok ? r.json() : null);
            if (u?.email) { ses.email = u.email; GG.store.set(SES, ses); }
            papel = (await rest("rpc/eh_equipe", { method: "POST", body: "{}" })) ? "autoridade" : "cidadao";
          } catch { papel = "cidadao"; }
        }
        const puxar = async () => { relatos = (await rest("relatos_publicos?select=*&order=criado_em.desc&limit=2000")).map(map); notificar(); };
        await puxar();
        setInterval(puxar, 30000); // trocar por Realtime (websocket) em produção
      },
      async criar(r) {
        const x = await rest("rpc/criar_relato", { method: "POST", body: JSON.stringify({ p: r }), headers: { Prefer: "return=representation" } });
        return x;
      },
      async subirFoto(blob) {
        const nome = `${crypto.randomUUID()}.jpg`;
        const r = await fetch(`${url}/storage/v1/object/fotos/${nome}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg" }, body: blob });
        if (!r.ok) throw new Error("Falha ao enviar foto");
        return { id: nome, url: `${url}/storage/v1/object/public/fotos/${nome}` };
      },
      async adicionarFoto(id, blob) {
        const f = await this.subirFoto(blob);
        await rest("rpc/adicionar_foto", { method: "POST", body: JSON.stringify({ p_id: id, p_foto: f }) });
      },
      async pedirConserto(id, blob) {
        const f = blob ? await this.subirFoto(blob) : null;
        await rest("rpc/pedir_conserto", { method: "POST", body: JSON.stringify({ p_id: id, p_foto: f }) });
      },
      // acesso da equipe: link por e-mail, só para quem a coordenação cadastrou (create_user: false)
      async entrar(email) {
        const volta = encodeURIComponent(location.origin + location.pathname);
        const r = await fetch(`${url}/auth/v1/otp?redirect_to=${volta}`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, create_user: false }) });
        if (r.ok) return;
        const e = await r.json().catch(() => ({}));
        if (r.status === 422 || /signup|not allowed|not found/i.test(e.msg || e.message || "")) throw new Error("Este e-mail não está cadastrado na equipe. Fale com a coordenação do GuGa.");
        if (r.status === 429) throw new Error("Muitos pedidos. Espere um minuto e tente de novo.");
        throw new Error(e.msg || e.message || "Não foi possível enviar o link agora.");
      },
      async sair() {
        const t = ses?.access_token;
        ses = null; GG.store.set(SES, null); papel = "cidadao";
        if (t) await fetch(`${url}/auth/v1/logout`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${t}` } }).catch(() => {});
      },
      sessao: () => ses ? { email: ses.email || "equipe" } : null,
      async lerPrivado(id) { const r = await rest(`fila_resgate?id=eq.${encodeURIComponent(id)}&select=contato`); return r?.[0] || null; },
      validarConserto: (id, ok) => rest("rpc/validar_conserto", { method: "POST", body: JSON.stringify({ p_id: id, p_ok: ok }) }),
      confirmar: (id) => rest("rpc/confirmar_relato", { method: "POST", body: JSON.stringify({ p_id: id }) }),
      cobrar: (id, canal) => rest("rpc/registrar_cobranca", { method: "POST", body: JSON.stringify({ p_id: id, p_canal: canal }) }),
      protocolo: (id, orgao, numero) => rest("rpc/registrar_protocolo", { method: "POST", body: JSON.stringify({ p_id: id, p_orgao: orgao, p_numero: numero }) }),
      atualizar: (id, patch) => rest("rpc/atualizar_status", { method: "POST", body: JSON.stringify({ p_id: id, p_status: patch.status, p_nota: patch.nota || null }) }),
    };
  }

  // ── 2. Artifact (prévia) ────────────────────────────────────────
  function artifact(db, assets, user) {
    let meuId = null;
    return {
      nome: "Prévia compartilhada",
      async iniciar() {
        meuId = user ? await user.id().catch(() => null) : null;
        db.collection("relatos").orderBy("criadoEm", "desc").limit(1000).onSnapshot((snap) => {
          relatos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          notificar();
        }, (e) => GG.toast("Não consegui ler os relatos: " + e.message, "erro"));
      },
      async criar(r) {
        const priv = r._privado; delete r._privado;
        const ref = await db.collection("relatos").add({ ...r, autor: meuId, criadoEm: new Date().toISOString(), status: "aberto", confirmacoes: 0,
          historico: [{ t: new Date().toISOString(), status: "aberto", nota: "Relato criado" }] });
        if (priv) await db.doc(`sos_privado/${ref.id}`).set(priv).catch(() => {});
        return { id: ref.id };
      },
      async subirFoto(blob) {
        if (!assets) throw new Error("Envio de fotos indisponível para o seu acesso.");
        const up = await assets.upload(blob, { type: "image/jpeg" });
        return { id: up.id, url: up.url };
      },
      async confirmar(id) {
        const r = relatos.find((x) => x.id === id);
        if (!r) return;
        const ja = GG.store.get("confirmados", []);
        if (ja.includes(id)) throw new Error("Você já confirmou este relato.");
        await db.doc(`relatos/${id}`).update({ confirmacoes: (r.confirmacoes || 0) + 1 });
        GG.store.set("confirmados", [...ja, id]);
      },
      async cobrar(id, canal) {
        const r = relatos.find((x) => x.id === id);
        if (!r || !marcarCobranca(id, canal)) return;
        await db.doc(`relatos/${id}`).update({ cobrancas: (r.cobrancas || 0) + 1 });
      },
      async protocolo(id, orgao, numero) {
        const r = relatos.find((x) => x.id === id), num = validarProtocolo(numero);
        if (!r || (r.protocolos || []).some((p) => p.numero === num)) return;
        const agora = new Date().toISOString();
        await db.doc(`relatos/${id}`).update({ protocolos: [...(r.protocolos || []), { orgao, numero: num, em: agora }].slice(0, 10),
          historico: [...(r.historico || []), { t: agora, status: r.status, nota: `Protocolo ${orgao === "prefeitura" ? "da Prefeitura" : "do Estado"} nº ${num} informado por morador`, por: "morador" }] });
      },
      async atualizar(id, patch) {
        const r = relatos.find((x) => x.id === id);
        const hist = [...(r?.historico || []), { t: new Date().toISOString(), status: patch.status, nota: patch.nota || "", por: "equipe" }];
        const extra = patch.status === "resolvido" ? { resolvidoEm: new Date().toISOString() } : {};
        await db.doc(`relatos/${id}`).update({ status: patch.status, historico: hist, ...extra });
      },
      async lerPrivado(id) { const s = await db.doc(`sos_privado/${id}`).get(); return s.exists ? s.data() : null; },
      async pedirConserto(id, blob) {
        const f = blob ? await this.subirFoto(blob) : null, r = relatos.find((x) => x.id === id);
        await db.doc(`relatos/${id}`).update({ conserto: { em: new Date().toISOString(), foto: f, pedidos: (r?.conserto?.pedidos || 0) + 1 },
          historico: [...(r?.historico || []), { t: new Date().toISOString(), status: r?.status || "aberto", nota: "Morador avisou que foi arrumado (aguarda validação)" }] });
      },
      async validarConserto(id, ok) {
        const r = relatos.find((x) => x.id === id), agora = new Date().toISOString();
        await db.doc(`relatos/${id}`).update(ok
          ? { status: "resolvido", resolvidoEm: r?.conserto?.em || agora, conserto: { ...(r?.conserto || {}), validadoEm: agora }, historico: [...(r?.historico || []), { t: agora, status: "resolvido", nota: "Conserto validado pela equipe GuGa", por: "equipe" }] }
          : { conserto: { __delete__: true }, historico: [...(r?.historico || []), { t: agora, status: r?.status || "aberto", nota: "Conserto não confirmado: continua com problema", por: "equipe" }] });
      },
      async adicionarFoto(id, blob) {
        const f = await this.subirFoto(blob), r = relatos.find((x) => x.id === id);
        await db.doc(`relatos/${id}`).update({ fotos: [...(r?.fotos || []), f].slice(0, 4) });
      },
    };
  }

  // ── 3. Local ────────────────────────────────────────────────────
  function local() {
    const salvar = () => GG.store.set("relatos_locais", relatos);
    return {
      nome: "Só neste aparelho",
      async iniciar() { relatos = GG.store.get("relatos_locais", []); notificar(); },
      async criar(r) {
        const x = { ...r, id: "loc-" + Date.now().toString(36), criadoEm: new Date().toISOString(), status: "aberto", confirmacoes: 0,
          historico: [{ t: new Date().toISOString(), status: "aberto", nota: "Relato criado" }] };
        delete x._privado;
        relatos = [x, ...relatos]; salvar(); notificar(); return x;
      },
      async subirFoto(blob) {
        const d = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
        return { id: "local", url: d };
      },
      async confirmar(id) { relatos = relatos.map((r) => r.id === id ? { ...r, confirmacoes: (r.confirmacoes || 0) + 1 } : r); salvar(); notificar(); },
      async cobrar(id, canal) { if (!marcarCobranca(id, canal)) return; relatos = relatos.map((r) => r.id === id ? { ...r, cobrancas: (r.cobrancas || 0) + 1 } : r); salvar(); notificar(); },
      async protocolo(id, orgao, numero) {
        const num = validarProtocolo(numero), agora = new Date().toISOString();
        relatos = relatos.map((r) => r.id !== id || (r.protocolos || []).some((p) => p.numero === num) ? r : { ...r, protocolos: [...(r.protocolos || []), { orgao, numero: num, em: agora }],
          historico: [...(r.historico || []), { t: agora, status: r.status, nota: `Protocolo ${orgao === "prefeitura" ? "da Prefeitura" : "do Estado"} nº ${num} informado por morador` }] });
        salvar(); notificar();
      },
      async adicionarFoto(id, blob) { const f = await this.subirFoto(blob); relatos = relatos.map((r) => r.id === id ? { ...r, fotos: [...(r.fotos || []), f] } : r); salvar(); notificar(); },
      async pedirConserto(id, blob) { const f = blob ? await this.subirFoto(blob) : null; relatos = relatos.map((r) => r.id === id ? { ...r, conserto: { em: new Date().toISOString(), foto: f } } : r); salvar(); notificar(); },
      async validarConserto(id, ok) {
        relatos = relatos.map((r) => r.id !== id ? r : ok ? { ...r, status: "resolvido", resolvidoEm: r.conserto?.em || new Date().toISOString(), conserto: { ...r.conserto, validadoEm: new Date().toISOString() } } : (({ conserto, ...x }) => x)(r));
        salvar(); notificar();
      },
      async atualizar(id, p) {
        relatos = relatos.map((r) => r.id === id ? { ...r, status: p.status, historico: [...(r.historico || []), { t: new Date().toISOString(), status: p.status, nota: p.nota || "" }], ...(p.status === "resolvido" ? { resolvidoEm: new Date().toISOString() } : {}) } : r);
        salvar(); notificar();
      },
    };
  }

  async function iniciar() {
    const C = GG.CONFIG;
    if (C.supabaseUrl && C.supabaseAnonKey) {
      impl = supabase(C.supabaseUrl, C.supabaseAnonKey);
    } else if (window.claude?.use) {
      const [db, assets, user] = await Promise.all([claude.use("db"), claude.use("assets"), claude.use("user")]);
      if (db) {
        impl = artifact(db, assets, user);
        try { papel = (await user?.canEdit()) ? "autoridade" : "cidadao"; } catch { /* sem papel */ }
      }
    }
    if (!impl) impl = local();
    try { await impl.iniciar(); } catch (e) { GG.toast("Sem conexão com o servidor. Usando dados deste aparelho.", "erro"); impl = local(); await impl.iniciar(); }
    GG.emit("backend", { nome: impl.nome, papel });
    esvaziarFila();
  }

  /** Envia um relato. Sem internet → fila. Devolve {offline:true} quando ficou na fila. */
  async function enviar(relato, fotosBlobs = []) {
    const tentar = async () => {
      const fotos = [];
      for (const b of fotosBlobs) fotos.push(await impl.subirFoto(b));
      return impl.criar({ ...relato, fotos });
    };
    if (!navigator.onLine) return guardar();
    try { return await tentar(); } catch (e) {
      if (/indispon|not_granted/i.test(e.message)) { GG.toast(e.message + " O relato segue sem foto.", "erro"); return impl.criar({ ...relato, fotos: [] }); }
      return guardar();
    }
    async function guardar() {
      const fotosDataUrl = [];
      for (const b of fotosBlobs) fotosDataUrl.push(await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }));
      fila.add({ relato, fotosDataUrl });
      return { offline: true };
    }
  }

  return {
    iniciar, enviar,
    confirmar: (id) => impl.confirmar(id),
    cobrar: (id, canal) => (impl.cobrar ? impl.cobrar(id, canal) : Promise.resolve()).catch(() => {}),  // contar nunca pode travar o envio
    protocolo: (id, orgao, numero) => impl.protocolo(id, orgao, numero),
    atualizar: (id, p) => impl.atualizar(id, p),
    adicionarFoto: (id, blob) => impl.adicionarFoto(id, blob),
    pedirConserto: (id, blob) => impl.pedirConserto(id, blob),
    validarConserto: (id, ok) => impl.validarConserto(id, ok),
    lerPrivado: (id) => impl.lerPrivado ? impl.lerPrivado(id) : Promise.resolve(null),
    relatos: () => relatos,
    ouvir: (fn) => { ouvintes.add(fn); fn(relatos); return () => ouvintes.delete(fn); },
    papel: () => papel,
    setPapel: (p) => { papel = p; GG.emit("backend", { nome: impl?.nome, papel }); },
    nome: () => impl?.nome,
    filaTamanho: () => fila.ler().length,
    temAcessoEquipe: () => !!impl?.entrar,
    entrar: (email) => impl.entrar(email),
    sair: async () => { await impl.sair(); GG.emit("backend", { nome: impl?.nome, papel }); },
    sessao: () => impl?.sessao ? impl.sessao() : null,
  };
})();
