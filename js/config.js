/* GuGa · configuração central. Tudo que muda por cidade/ambiente fica aqui. */
window.GG = window.GG || {};

// Estado do Guaíba: cor (semáforo) e uma frase curta para cada um. Usado na tela Hoje, na imagem e no WhatsApp.
GG.COR_ESTADO = { normal: "#2e7d32", atencao: "#f2b705", alerta: "#e8710a", inundacao: "#d32f2f" };
GG.FRASE_ESTADO = {
  normal: "Rio normal. Bom momento para se preparar.",
  atencao: "Rio perto do alerta. Fique atento aos avisos.",
  alerta: "Prepare-se para sair se mora em área baixa.",
  inundacao: "Áreas baixas alagando. Saia se a água chegar.",
};

GG.CONFIG = {
  versao: "0.9.0",

  // Backend de produção (Supabase). Vazio = app usa o banco do Artifact (prévia) ou o armazenamento local.
  // Chave pública (anon): pode ficar no código. Quem protege os dados são as regras do banco (RLS) e as funções RPC.
  supabaseUrl: "https://hsyhjbzjdavuoxhqyuwm.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzeWhqYnpqZGF2dW94aHF5dXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NzA1OTcsImV4cCI6MjEwODA0NjU5N30.mcC5iy9NlwyZpPwrk68_W5vcrJCsaxowv8kL6Y-ZvBQ",

  // Fontes ao vivo. Todas abertas e gratuitas. ANA não libera CORS, então passa pela função proxy.
  fontes: {
    openMeteo: "https://api.open-meteo.com/v1/forecast",
    glofas: "https://flood-api.open-meteo.com/v1/flood",
    nominatim: "https://nominatim.openstreetmap.org/search",
    terreno: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
    // Função edge do Supabase (supabase/functions/nivel-guaiba). Devolve {serie:[{t,cm}], estacao, fonte}.
    nivelProxy: "/functions/v1/nivel-guaiba",
    // mapa base vetorial com nomes de ruas (OpenStreetMap via OpenFreeMap: gratuito, sem chave, sem limite)
    estiloMapa: "https://tiles.openfreemap.org/styles/positron",
    mapaReserva: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  },

  // Régua de referência das manchas do IPH/UFRGS: Cais Mauá C6 (cm).
  guaiba: {
    estacaoPrincipal: { nome: "Usina do Gasômetro", codigoANA: "87444000" },
    // Cotas oficiais. Cais Mauá C6: boletins do SGB/SACE (conferido no boletim de 30/07/2026: alerta 2,60 m, inundação 3,00 m).
    // Recorde: 5,35 m na régua em 05/05/2024 (o SGB estimou 5,37 m pelas marcas de cheia). Gasômetro: Gov. RS, 28/05/2024.
    caisMaua: { alerta: 260, inundacao: 300, recorde: 535 },
    gasometro: { alerta: 315, inundacao: 360 },
    // Diferença entre as cotas oficiais das duas réguas (3,60 − 3,00). Calibrar com o SGB antes de produção.
    offsetGasometroParaCaisMaua: -60,
  },

  telefones: [
    { n: "193", nome: "Bombeiros", quando: "Pessoas ilhadas, resgate" },
    { n: "199", nome: "Defesa Civil", quando: "Enchente, deslizamento, saída de casa" },
    { n: "192", nome: "SAMU", quando: "Emergência de saúde" },
    { n: "190", nome: "Brigada Militar", quando: "Crime, saque" },
    { n: "156", nome: "Prefeitura (156)", quando: "Bueiro entupido e limpeza, fora de emergência" },
  ],
  alertasOficiais: [
    { canal: "SMS", como: "Envie o seu CEP para 40199", detalhe: "Gratuito. Alertas da Defesa Civil para a sua região." },
    { canal: "WhatsApp", como: "(61) 2034-4611", detalhe: "Salve o número e mande \"Oi\". Canal nacional da Defesa Civil." },
    { canal: "Cell Broadcast", como: "Automático", detalhe: "Chega sozinho em celulares 4G/5G na área de risco. Não desligue o celular." },
  ],

  // Para quem mandar a cobrança. Canais oficiais conferidos nos sites da Prefeitura e do Estado em 20/10/2026.
  // Quem ocupa o cargo muda com a data (o governador eleito em 2026 toma posse em janeiro de 2027).
  urlPublica: "https://guga-woad.vercel.app/", // aparece no fim de cada cobrança e no alerta (Vercel; espelho: victoriacomerlato.github.io/guga-site)
  cobranca: {
    conferidoEm: "2026-10-20",
    prefeitura: {
      "Porto Alegre": {
        orgao: "Prefeitura de Porto Alegre", chefe: [{ ate: "2029-01-01", nome: "Prefeito Sebastião Melo" }],
        responsavel: "Bueiro, boca de lobo e rede de chuva são responsabilidade da Prefeitura (DMAE).",
        canais: [
          { id: "zap156", rot: "WhatsApp do 156", sub: "Canal oficial da Prefeitura", tipo: "whatsapp", numero: "555134330156", dica: "O 156 responde com um menu. Escolha a opção de solicitação; a mensagem já vai pronta." },
          { id: "web156", rot: "Site do 156", sub: "Gera número de protocolo", tipo: "link", url: "https://156web.procempa.com.br/", dica: "A mensagem foi copiada. No site, escolha drenagem ou limpeza de boca de lobo e cole. Guarde o protocolo e cole aqui embaixo." },
          { id: "ouvpoa", rot: "Ouvidoria da Prefeitura", sub: "Para quando o 156 não resolve", tipo: "link", url: "https://ouvidoria.procempa.com.br/ouvidoriaweb/", dica: "A mensagem foi copiada. Cole no formulário da Ouvidoria." },
          { id: "igpoa", rot: "Instagram da Prefeitura", sub: "@prefpoa", tipo: "instagram", usuario: "prefpoa" },
          { id: "xpoa", rot: "X (Twitter) da Prefeitura", sub: "@Prefeitura_POA", tipo: "x", usuario: "Prefeitura_POA" },
          { id: "tel156", rot: "Ligar para o 156", sub: "De outra cidade: (51) 3289-0156", tipo: "tel", numero: "156" },
        ],
      },
    },
    estado: {
      orgao: "Governo do Estado do Rio Grande do Sul",
      chefe: [{ ate: "2027-01-05", nome: "Governador Eduardo Leite", eleito: "governador eleito Luciano Zucco" }, { ate: "2031-01-06", nome: "Governador Luciano Zucco" }],
      responsavel: "O Estado cuida dos diques e comportas da região metropolitana, dos rios e da Defesa Civil estadual.",
      canais: [
        { id: "mailrs", rot: "E-mail da Ouvidoria do Estado", sub: "ouvidoriageral@casacivil.rs.gov.br", tipo: "email", para: "ouvidoriageral@casacivil.rs.gov.br" },
        { id: "webrs", rot: "Formulário da Ouvidoria do Estado", sub: "Gera protocolo. Pede login gov.br", tipo: "link", url: "https://ouvidoriageral.rs.gov.br/ouvidoria", dica: "A mensagem foi copiada. Entre com a conta gov.br e cole no formulário. Guarde o protocolo e cole aqui embaixo." },
        { id: "telrs", rot: "Ligar para a Ouvidoria", sub: "0800 541 6136, de graça", tipo: "tel", numero: "08005416136" },
      ],
    },
  },

  // Morros pré-configurados para a vista 3D (centro, raio em km).
  morros: [
    { id: "santana", nome: "Morro Santana", cidade: "Porto Alegre", lat: -30.0505, lon: -51.1255, raio: 1.6 },
    { id: "policia", nome: "Morro da Polícia", cidade: "Porto Alegre", lat: -30.0915, lon: -51.1845, raio: 1.4 },
    { id: "cruz", nome: "Morro da Cruz", cidade: "Porto Alegre", lat: -30.0545, lon: -51.1755, raio: 1.0 },
    { id: "osso", nome: "Morro do Osso", cidade: "Porto Alegre", lat: -30.1175, lon: -51.2385, raio: 1.0 },
    { id: "mucum", nome: "Vale do Taquari (Muçum)", cidade: "Muçum", lat: -29.165, lon: -51.871, raio: 2.2 },
  ],
};

/* Utilidades gerais */
GG.$ = (s, el = document) => el.querySelector(s);
GG.$$ = (s, el = document) => [...el.querySelectorAll(s)];
GG.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
GG.fmt = (n, d = 0) => (n == null || !isFinite(n)) ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
GG.m = (cm, d = 2) => GG.fmt(cm / 100, d) + " m";
GG.store = {
  get(k, def) { try { const v = localStorage.getItem("guga:" + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem("guga:" + k, JSON.stringify(v)); } catch { /* armazenamento bloqueado */ } },
};
GG.haversine = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
GG.tempo = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} dias`;
};
GG.toast = (msg, tipo = "ok") => {
  document.querySelectorAll(".toast").forEach((v) => v.remove()); // um aviso por vez
  const t = document.createElement("div");
  t.className = "toast " + tipo;
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("on"), 10);
  setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 400); }, Math.max(4200, msg.length * 70));
};
GG.bus = new EventTarget();
GG.emit = (n, d) => GG.bus.dispatchEvent(new CustomEvent(n, { detail: d }));
GG.on = (n, fn) => GG.bus.addEventListener(n, (e) => fn(e.detail));
