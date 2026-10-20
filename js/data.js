/* GuGa · camadas de dados (IPH/UFRGS, CC BY 4.0) e consultas espaciais no navegador. */
GG.data = (() => {
  const cache = {};
  const ARQ = {
    cotas: "data/poa_cotas.geojson",
    bairros: "data/poa_bairros.geojson",
    marcas: "data/poa_marcas_2024.geojson",
    diques: "data/rmpa_diques.geojson",
    polders: "data/rmpa_polders.geojson",
    comportas: "data/rmpa_comportas.geojson",
    ebaps: "data/rmpa_ebaps.geojson",
    abrigos: "data/abrigos_2024.geojson",
    barragens: "data/barragens_2024.geojson",
    mancha: "data/rh_mancha_2024.geojson",
    deslizamentos: "data/rh_deslizamentos_2024.geojson",
    bacia: "data/rh_bacia.geojson",
    municipios: "data/municipios_rs.json",
  };

  async function load(nome) {
    if (cache[nome]) return cache[nome];
    cache[nome] = fetch(ARQ[nome]).then((r) => {
      if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
      return r.json();
    }).then((j) => { if (j.features) indexar(j); return j; });
    return cache[nome];
  }

  // bbox por feição para filtrar antes do ponto-no-polígono
  function indexar(fc) {
    for (const f of fc.features) {
      let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
      walk(f.geometry, (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; });
      f.bbox = [x0, y0, x1, y1];
    }
  }
  function walk(g, fn) {
    if (!g) return;
    const c = g.coordinates;
    if (g.type === "Point") fn(c[0], c[1]);
    else if (g.type === "LineString" || g.type === "MultiPoint") c.forEach((p) => fn(p[0], p[1]));
    else if (g.type === "Polygon" || g.type === "MultiLineString") c.forEach((r) => r.forEach((p) => fn(p[0], p[1])));
    else if (g.type === "MultiPolygon") c.forEach((pl) => pl.forEach((r) => r.forEach((p) => fn(p[0], p[1]))));
  }
  function anel(pt, ring) {
    let dentro = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  }
  function noPoligono(pt, g) {
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return polys.some((p) => anel(pt, p[0]) && !p.slice(1).some((h) => anel(pt, h)));
  }
  function contem(fc, pt) {
    return fc.features.filter((f) => {
      const b = f.bbox;
      return pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3] && noPoligono(pt, f.geometry);
    });
  }
  // distância aproximada (m) de um ponto até a borda mais próxima de uma coleção de polígonos
  function distBorda(fc, pt, raioM = 3000) {
    const grau = raioM / 111000;
    let melhor = Infinity;
    for (const f of fc.features) {
      const b = f.bbox;
      if (pt[0] < b[0] - grau || pt[0] > b[2] + grau || pt[1] < b[1] - grau || pt[1] > b[3] + grau) continue;
      walk(f.geometry, (x, y) => { const d = GG.haversine(pt, [x, y]); if (d < melhor) melhor = d; });
    }
    return melhor;
  }

  /** Análise de um endereço: faixa de cota (POA), bairro, mancha de 2024, pólder. */
  async function analisar(lon, lat) {
    const pt = [lon, lat];
    const [cotas, bairros, polders] = await Promise.all([load("cotas"), load("bairros"), load("polders")]);
    const b = contem(bairros, pt)[0];
    const pol = contem(polders, pt)[0];
    const faixa = contem(cotas, pt).sort((a, c) => a.properties.cm - c.properties.cm)[0];
    const dentroPOA = !!b;
    let mancha = null;
    if (!dentroPOA) {
      try {
        const m = await load("mancha");
        const dentro = contem(m, pt).length > 0;
        mancha = { dentro, dist: dentro ? 0 : distBorda(m, pt, 4000) };
      } catch { mancha = null; }
    }
    return {
      bairro: b?.properties.bairro || null,
      regiao: b?.properties.regiao || null,
      cotaMediaBairro: b?.properties.cota_media_m ?? null,
      polder: pol?.properties.polder || null,
      // faixa mais baixa (≤ 2,94 m) não tem limite inferior: assume o terreno acima do nível normal do lago (~1,00 m)
      faixa: faixa ? { cm: faixa.properties.cm, prev: Math.max(100, faixa.properties.prev_cm), evento: faixa.properties.evento, baixa: faixa.properties.prev_cm === 0 } : null,
      foraDeTodas: dentroPOA && !faixa,
      dentroPOA,
      mancha,
    };
  }

  async function abrigosProximos(lon, lat, n = 3, faixaCasaCm = null) {
    const fc = await load("abrigos");
    let cotas = null;
    try { cotas = await load("cotas"); } catch { /* sem cotas */ }
    return fc.features
      .filter((f) => !/animais/i.test(f.properties.tipo))
      .map((f) => {
        const c = f.geometry.coordinates;
        const fx = cotas ? contem(cotas, c).sort((a, b) => a.properties.cm - b.properties.cm)[0] : null;
        return { ...f.properties, lon: c[0], lat: c[1], dist: GG.haversine([lon, lat], c), alagaEm: fx ? fx.properties.cm : null };
      })
      // só sugere abrigo mais alto que a casa (ou fora de todas as manchas)
      .filter((a) => a.alagaEm == null || (faixaCasaCm != null && a.alagaEm > faixaCasaCm + 100))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, n);
  }

  return { load, contem, analisar, abrigosProximos, ARQ };
})();
