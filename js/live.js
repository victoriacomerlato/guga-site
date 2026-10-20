/* GuGa · dados ao vivo com falha explícita. Nunca mostra simulação como se fosse real. */
GG.live = (() => {
  const C = GG.CONFIG;
  const BRT = "America/Sao_Paulo";
  let nivel = null;     // {serie:[{t,cm}], fonte, simulado, estacao}
  let simNivel = null;  // nível escolhido no simulador (cm)

  async function getJSON(url, ms = 9000) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }

  // Série simulada: cheia subindo ~3 cm/h a partir de 2,40 m (treino). Marcada como SIMULAÇÃO em toda a interface.
  function serieSimulada(alvoCm) {
    const agora = Date.now(), pts = [];
    const fim = alvoCm ?? 285;
    for (let h = 36; h >= 0; h--) {
      const f = 1 - h / 36;
      const cm = 225 + (fim - 225) * Math.pow(f, 1.4); // subida que acelera, como numa cheia real
      pts.push({ t: new Date(agora - h * 3.6e6).toISOString(), cm: Math.round(cm) });
    }
    return pts;
  }

  async function carregarNivel() {
    const base = C.supabaseUrl ? C.supabaseUrl + C.fontes.nivelProxy : null;
    if (base) {
      try {
        const j = await getJSON(base + "?horas=48");
        if (j.serie?.length) {
          const off = j.regua === "gasometro" ? C.guaiba.offsetGasometroParaCaisMaua : 0;
          nivel = { serie: j.serie.map((p) => ({ t: p.t, cm: p.cm + off })), fonte: j.fonte, estacao: j.estacao, simulado: false, convertido: off !== 0 };
          GG.emit("nivel", nivel);
          return nivel;
        }
      } catch { /* cai para simulação */ }
    }
    nivel = { serie: serieSimulada(simNivel), fonte: "Simulação de treino (sem conexão com a ANA nesta versão)", estacao: "—", simulado: true };
    GG.emit("nivel", nivel);
    return nivel;
  }

  function simular(cm) {
    simNivel = cm;
    if (!nivel || nivel.simulado) { nivel = { ...(nivel || {}), serie: serieSimulada(cm), simulado: true, fonte: "Simulação de treino" }; GG.emit("nivel", nivel); }
  }

  /** Tendência por regressão linear nas últimas N horas → cm/h, com erro. */
  function tendencia(serie, horas = 6) {
    if (!serie?.length) return null;
    const fim = new Date(serie.at(-1).t).getTime();
    const pts = serie.filter((p) => fim - new Date(p.t).getTime() <= horas * 3.6e6);
    if (pts.length < 3) return null;
    const xs = pts.map((p) => (new Date(p.t).getTime() - fim) / 3.6e6), ys = pts.map((p) => p.cm);
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let sxy = 0, sxx = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
    const b = sxy / sxx;
    const res = Math.sqrt(ys.reduce((a, y, i) => a + (y - (my + b * (xs[i] - mx))) ** 2, 0) / Math.max(1, n - 2));
    return { cmh: b, erro: res / Math.sqrt(sxx), atual: serie.at(-1).cm };
  }

  /** Quando o nível chega em `alvo` (cm)? Devolve horas [min, provável, max] ou null. */
  function eta(serie, alvo) {
    const t = tendencia(serie, 6) || tendencia(serie, 24);
    if (!t) return null;
    if (t.atual >= alvo) return { ja: true, ...t };
    if (t.cmh <= 0.3) return { naoSobe: true, ...t };
    const rapido = t.cmh + 1.5 * t.erro + 0.15 * t.cmh, lento = Math.max(0.2, t.cmh - 1.5 * t.erro - 0.15 * t.cmh);
    const falta = alvo - t.atual;
    return { horas: falta / t.cmh, min: falta / rapido, max: falta / lento, ...t };
  }

  async function chuva(lat, lon) {
    const url = `${C.fontes.openMeteo}?latitude=${lat}&longitude=${lon}&hourly=precipitation&past_days=1&forecast_days=3&timezone=${encodeURIComponent(BRT)}`;
    const j = await getJSON(url);
    const t = j.hourly.time, p = j.hourly.precipitation.map((v) => v || 0);
    const agora = new Date().toLocaleString("sv-SE", { timeZone: BRT }).slice(0, 13).replace(" ", "T") + ":00";
    const i = Math.max(0, t.indexOf(agora));
    const soma = (a, b) => p.slice(a, b).reduce((x, y) => x + y, 0);
    return { ult24: soma(Math.max(0, i - 24), i), prox24: soma(i, i + 24), prox72: soma(i, i + 72), maxHora: Math.max(...p.slice(i, i + 72)) };
  }

  /** Vento e temporal nas próximas 24 h (Open-Meteo). Códigos 96/99 = trovoada com granizo. */
  async function tempo(lat, lon) {
    const url = `${C.fontes.openMeteo}?latitude=${lat}&longitude=${lon}&hourly=wind_gusts_10m,weather_code,precipitation&forecast_days=2&timezone=${encodeURIComponent(BRT)}`;
    const j = await getJSON(url);
    const agora = Date.now(), h = j.hourly;
    let rajada = 0, granizo = null, trovoada = null, chuva = 0;
    h.time.forEach((t, i) => {
      const ts = new Date(t + ":00-03:00").getTime();
      if (ts < agora - 3.6e6 || ts > agora + 24 * 3.6e6) return;
      rajada = Math.max(rajada, h.wind_gusts_10m[i] || 0);
      chuva += h.precipitation[i] || 0;
      if ([96, 99].includes(h.weather_code[i]) && !granizo) granizo = t;
      if (h.weather_code[i] >= 95 && !trovoada) trovoada = t;
    });
    return { rajada, granizo, trovoada, chuva };
  }

  async function geocodificar(q) {
    const url = `${C.fontes.nominatim}?q=${encodeURIComponent(q)}&format=jsonv2&countrycodes=br&limit=5&viewbox=-57.7,-27.0,-49.6,-33.8&bounded=1&accept-language=pt-BR`;
    const j = await getJSON(url);
    return j.map((x) => ({ nome: x.display_name, lat: +x.lat, lon: +x.lon }));
  }

  return { carregarNivel, simular, tendencia, eta, chuva, tempo, geocodificar, get nivel() { return nivel; } };
})();
