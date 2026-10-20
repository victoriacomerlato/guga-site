/* GuGa · Morro 3D em 4 passos: a chuva cai, a água se junta, desce com força, onde barrar.
 * Relevo real: AWS Terrain Tiles (SRTM/Copernicus, ~30 m). Sem acesso: morro de exemplo, marcado como tal.
 * Hidrologia: preenchimento de depressões, direção D8, área de contribuição, Manning e Kirpich. */
GG.morro = (() => {
  const N = 180;
  let dem = null, H = null, three = null, sel = -1, iniciado = false, passo = 1;
  const P = { chuva: 60, uso: "cidade", exag: 1.9 };
  const USO = { mata: { C: 0.25, n: 0.06 }, misto: { C: 0.55, n: 0.035 }, cidade: { C: 0.85, n: 0.016 } };
  const CAMPO_M2 = 7140; // campo de futebol oficial (105 × 68 m)

  // ── relevo ───────────────────────────────────────────────────────────
  function didatico(nome) {
    const z = new Float32Array(N * N), cel = 14;
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const g = Array.from({ length: 10 }, () => Array.from({ length: 10 }, rnd));
    const ruido = (x, y) => { const gx = x * 8, gy = y * 8, i = Math.min(8, Math.floor(gx)), j = Math.min(8, Math.floor(gy)), fx = gx - i, fy = gy - j, sm = (t) => t * t * (3 - 2 * t);
      const a = g[j][i], b = g[j][i + 1], c = g[j + 1][i], d = g[j + 1][i + 1];
      return a + (b - a) * sm(fx) + (c - a) * sm(fy) + (a - b - c + d) * sm(fx) * sm(fy); };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = i / (N - 1), y = j / (N - 1);
      let h = 240 * Math.exp(-(((x - 0.45) / 0.19) ** 2 + ((y - 0.36) / 0.24) ** 2) / 2)
        + 140 * Math.exp(-(((x - 0.74) / 0.12) ** 2 + ((y - 0.28) / 0.15) ** 2) / 2)
        + 85 * Math.exp(-(((x - 0.22) / 0.11) ** 2 + ((y - 0.18) / 0.11) ** 2) / 2);
      for (let k = 0; k < 5; k++) { // ravinas por onde a enxurrada desce
        const ang = -0.15 + k * 0.5, ux = Math.cos(ang + 1.25), uy = Math.sin(ang + 1.25);
        const dx = x - (0.45 + ux * 0.05), dy = y - (0.36 + uy * 0.05);
        const along = dx * ux + dy * uy, perp = Math.abs(-dx * uy + dy * ux);
        if (along > 0) h -= 26 * Math.exp(-((perp / 0.022) ** 2)) * Math.min(1, along * 4);
      }
      h += 8 * (ruido(x * 0.98, y * 0.98) - 0.5) + 4;
      h = Math.max(h, 3 + 3 * (1 - y));
      z[j * N + i] = h;
    }
    return { z, n: N, cel, bbox: null, real: false, nome };
  }

  async function carregarReal(m) {
    const z = 14, R = m.raio * 1000;
    const dLat = R / 111320, dLon = R / (111320 * Math.cos(m.lat * Math.PI / 180));
    const bbox = [m.lon - dLon, m.lat - dLat, m.lon + dLon, m.lat + dLat];
    const tx = (lon) => (lon + 180) / 360 * 2 ** z;
    const ty = (lat) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
    const x0 = Math.floor(tx(bbox[0])), x1 = Math.floor(tx(bbox[2])), y0 = Math.floor(ty(bbox[3])), y1 = Math.floor(ty(bbox[1]));
    const W = (x1 - x0 + 1) * 256, Hh = (y1 - y0 + 1) * 256;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = Hh;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const tiles = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push({ x, y });
    await Promise.all(tiles.map(({ x, y }) => new Promise((ok, err) => {
      const im = new Image(); im.crossOrigin = "anonymous";
      const t = setTimeout(() => err(new Error("tempo esgotado")), 10000);
      im.onload = () => { clearTimeout(t); ctx.drawImage(im, (x - x0) * 256, (y - y0) * 256); ok(); };
      im.onerror = () => { clearTimeout(t); err(new Error("sem acesso ao relevo")); };
      im.src = GG.CONFIG.fontes.terreno.replace("{z}", z).replace("{x}", x).replace("{y}", y);
    })));
    const px = ctx.getImageData(0, 0, W, Hh).data;
    const elev = (X, Y) => { const i = (Math.min(Hh - 1, Math.max(0, Y | 0)) * W + Math.min(W - 1, Math.max(0, X | 0))) * 4; return px[i] * 256 + px[i + 1] + px[i + 2] / 256 - 32768; };
    const out = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const lon = bbox[0] + (bbox[2] - bbox[0]) * i / (N - 1), lat = bbox[3] - (bbox[3] - bbox[1]) * j / (N - 1);
      const X = (tx(lon) - x0) * 256, Y = (ty(lat) - y0) * 256, fx = X - Math.floor(X), fy = Y - Math.floor(Y);
      const a = elev(X, Y), b = elev(X + 1, Y), c = elev(X, Y + 1), d = elev(X + 1, Y + 1);
      out[j * N + i] = Math.max(0, a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy);
    }
    return { z: out, n: N, cel: (2 * R) / (N - 1), bbox, real: true, nome: m.nome };
  }

  // ── hidrologia ───────────────────────────────────────────────────────
  const VIZ = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  function analisar(d) {
    const n = d.n, z = Float32Array.from(d.z), tot = n * n;
    const feito = new Uint8Array(tot), heap = [];
    const push = (i) => { heap.push(i); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (z[heap[p]] <= z[heap[k]]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && z[heap[l]] < z[heap[m]]) m = l; if (r < heap.length && z[heap[r]] < z[heap[m]]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    for (let i = 0; i < n; i++) for (const j of [0, n - 1]) for (const c of [j * n + i, i * n + j]) if (!feito[c]) { feito[c] = 1; push(c); }
    while (heap.length) {
      const c = pop(), ci = c % n, cj = (c / n) | 0;
      for (const [dx, dy] of VIZ) { const x = ci + dx, y = cj + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue; const k = y * n + x; if (feito[k]) continue; feito[k] = 1; if (z[k] <= z[c]) z[k] = z[c] + 0.01; push(k); }
    }
    const dir = new Int32Array(tot).fill(-1), slope = new Float32Array(tot);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const c = j * n + i; let best = 0, bk = -1, mx = 0;
      for (const [dx, dy] of VIZ) {
        const x = i + dx, y = j + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const k = y * n + x, dist = d.cel * Math.hypot(dx, dy), s = (z[c] - z[k]) / dist;
        if (s > best) { best = s; bk = k; }
        mx = Math.max(mx, (d.z[c] - d.z[k]) / dist);
      }
      dir[c] = bk; slope[c] = Math.max(mx, best, 0.002);
    }
    const ordem = Array.from({ length: tot }, (_, i) => i).sort((a, b) => z[b] - z[a]);
    const acc = new Float32Array(tot).fill(1), len = new Float32Array(tot);
    for (const c of ordem) { const k = dir[c]; if (k < 0) continue; acc[k] += acc[c]; const L = len[c] + d.cel * Math.hypot((k % n) - (c % n), ((k / n) | 0) - ((c / n) | 0)); if (L > len[k]) len[k] = L; }
    const areaCel = d.cel * d.cel, limiar = 30000 / areaCel;
    const canal = (c) => acc[c] >= limiar;
    const cand = []; for (let c = 0; c < tot; c++) if (canal(c)) cand.push(c);
    const temCima = new Uint8Array(tot); for (const u of cand) if (dir[u] >= 0) temCima[dir[u]] = slope[u] > 0.08 ? 2 : Math.max(temCima[dir[u]], 1);
    const longe = (lista, c, m) => lista.every((b) => Math.hypot((b.c % n) - (c % n), ((b.c / n) | 0) - ((c / n) | 0)) * d.cel > m);
    const barreiras = [];
    cand.filter((c) => slope[c] > 0.06 && slope[c] < 0.45).sort((a, b) => acc[b] * slope[b] - acc[a] * slope[a])
      .forEach((c) => { if (barreiras.filter((b) => b.tipo === "contencao").length < 4 && longe(barreiras, c, 260)) barreiras.push({ c, tipo: "contencao" }); });
    cand.filter((c) => slope[c] < 0.035 && acc[c] * areaCel > 60000 && temCima[c] === 2)
      .sort((a, b) => acc[b] - acc[a]).forEach((c) => { if (barreiras.filter((b) => b.tipo === "detencao").length < 2 && longe(barreiras, c, 260)) barreiras.push({ c, tipo: "detencao" }); });
    if (!barreiras.some((b) => b.tipo === "detencao")) { const c = cand.filter((x) => slope[x] < 0.08).sort((a, b) => acc[b] - acc[a])[0]; if (c != null) barreiras.push({ c, tipo: "detencao" }); }
    let critica = 0; for (let c = 0; c < tot; c++) if (slope[c] > 0.3) critica++;
    const borda = (c) => { const i = c % n, j = (c / n) | 0; return i <= 1 || j <= 1 || i >= n - 2 || j >= n - 2; };
    // ponto perigoso padrão: canal grande ainda inclinado, antes de chegar na borda
    const zmaxD = d.z.reduce((m, v) => Math.max(m, v), 1);
    const miolo = (c) => { const i = c % n, j = (c / n) | 0, m = n * 0.18; return i > m && j > m && i < n - m && j < n - m; };
    const perigoso = cand.filter((c) => miolo(c) && d.z[c] < zmaxD * 0.35 && slope[c] > 0.02).sort((a, b) => acc[b] * Math.sqrt(slope[b]) - acc[a] * Math.sqrt(slope[a]))[0]
      ?? cand.filter((c) => !borda(c)).sort((a, b) => acc[b] - acc[a])[0] ?? ordem.at(-1);
    let topo = 0; for (let c = 1; c < tot; c++) if (d.z[c] > d.z[topo]) topo = c;
    const baixo = cand.filter((c) => slope[c] < 0.05).sort((a, b) => acc[b] - acc[a])[0] ?? ordem.at(-1);
    return { zf: z, dir, acc, slope, len, canal, barreiras, areaCel, perigoso, topo, baixo, critica, borda };
  }

  function fisica(c) {
    const u = USO[P.uso], A = H.acc[c] * H.areaCel, S = Math.max(0.003, H.slope[c]);
    const Q = u.C * P.chuva * A / 3.6e6, b = P.uso === "mata" ? 3 : 8;
    let lo = 0.0005, hi = 6;
    for (let k = 0; k < 60; k++) { const h = (lo + hi) / 2, R = b * h / (b + 2 * h), q = (1 / u.n) * b * h * R ** (2 / 3) * Math.sqrt(S); if (q > Q) hi = h; else lo = h; }
    const h = (lo + hi) / 2, v = Q / (b * h);
    const L = Math.max(H.len[c], dem.cel), quedaZ = Math.max(1, dem.z[H.topo] - dem.z[c]);
    const tc = 0.0195 * L ** 0.77 * Math.max(0.005, quedaZ / L) ** -0.385 * (P.uso === "cidade" ? 0.4 : P.uso === "misto" ? 0.6 : 1);
    return { A, Q, h, v, vh: v * h, forca: 1000 * v * v * h, tc, S, L, quedaZ };
  }
  const nivelPerigo = (vh, h) => vh >= 1 ? 3 : vh >= 0.5 ? 2 : vh >= 0.25 || h >= 0.25 ? 1 : 0;

  // ── cena 3D ──────────────────────────────────────────────────────────
  const corCSS = (v) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#3fd98a");

  function montarCena() {
    const host = GG.$("#palco3d");
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(3, Math.max(2, devicePixelRatio || 1))); // nitidez: no mínimo 2× mesmo em tela comum
    renderer.setSize(host.clientWidth || 800, host.clientHeight || 600);
    host.querySelector("canvas")?.remove();
    host.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, (host.clientWidth || 4) / (host.clientHeight || 3), 5, 30000);
    scene.add(new THREE.HemisphereLight(0xf4f6ef, 0x4a4030, 0.6));
    const sol = new THREE.DirectionalLight(0xfff1dc, 0.72); sol.position.set(-900, 1400, 700); scene.add(sol);
    const t = { renderer, scene, cam, host, rot: 0.75, inc: 0.62, dist: 0, alvo: null, grupo: new THREE.Group(), rotulos: {} };
    scene.add(t.grupo);
    let arr = null, pinca = null;
    const el = renderer.domElement;
    el.addEventListener("pointerdown", (e) => { arr = { x: e.clientX, y: e.clientY, r: t.rot, i: t.inc, mov: 0 }; t.alvo = null; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => { if (!arr || pinca) return; const dx = e.clientX - arr.x, dy = e.clientY - arr.y; arr.mov = Math.max(arr.mov, Math.hypot(dx, dy)); t.rot = arr.r - dx * 0.008; t.inc = Math.min(1.4, Math.max(0.28, arr.i - dy * 0.006)); });
    el.addEventListener("pointerup", (e) => { if (arr && arr.mov < 6) clicar(e); arr = null; });
    el.addEventListener("wheel", (e) => { e.preventDefault(); t.dist = Math.min(t.dist0 * 2, Math.max(t.dist0 * 0.4, t.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
    el.addEventListener("touchmove", (e) => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinca) t.dist = Math.min(t.dist0 * 2, Math.max(t.dist0 * 0.4, t.dist * pinca / d)); pinca = d; } }, { passive: true });
    el.addEventListener("touchend", () => { pinca = null; });
    new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }).observe(host);
    return t;
  }

  function rotulo(id, txt, cls = "") {
    const t = three;
    if (!t.rotulos[id]) { const el = document.createElement("div"); el.className = "rotulo3d " + cls; t.host.appendChild(el); t.rotulos[id] = { el, p: new THREE.Vector3(), on: true }; }
    const r = t.rotulos[id]; r.el.className = "rotulo3d " + cls; r.el.textContent = txt; return r;
  }

  function construir() {
    const t = three, n = dem.n, cel = dem.cel, ex = P.exag, tam = (n - 1) * cel;
    while (t.grupo.children.length) { const o = t.grupo.children.pop(); o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }
    Object.values(t.rotulos).forEach((r) => r.el.remove()); t.rotulos = {};
    const pos = (i, j, dz = 0) => new THREE.Vector3(i * cel - tam / 2, (dem.z[j * n + i] + dz) * ex, j * cel - tam / 2);
    t.pos = pos; t.tam = tam;
    // terreno: verde no baixo, terra cáqui no alto; encostas íngremes ganham tom de barro (só no passo 4)
    const geo = new THREE.PlaneGeometry(tam, tam, n - 1, n - 1); geo.rotateX(-Math.PI / 2);
    const P_ = geo.attributes.position, cores = new Float32Array(P_.count * 3);
    const zmax = dem.z[H.topo] || 1;
    const cB = new THREE.Color("#6f8a4a"), cM = new THREE.Color("#a59d6c"), cA = new THREE.Color("#bfae80"), cC = new THREE.Color("#b5662e"), tmp = new THREE.Color();
    for (let k = 0; k < P_.count; k++) {
      const c = k, e = dem.z[c] / zmax;
      P_.setY(k, dem.z[c] * ex);
      if (e < 0.5) tmp.copy(cB).lerp(cM, e * 2); else tmp.copy(cM).lerp(cA, (e - 0.5) * 2);
      if (passo === 4 && H.slope[c] > 0.3) tmp.lerp(cC, 0.6);
      cores.set([tmp.r, tmp.g, tmp.b], k * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
    geo.computeVertexNormals();
    t.terreno = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    t.grupo.add(t.terreno);
    // curvas de nível a cada 20 m (como num mapa de verdade)
    const curvas = [], passoZ = 20;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], zs = q.map(([a, b]) => dem.z[b * n + a]);
      const lo = Math.ceil(Math.min(...zs) / passoZ) * passoZ, hi = Math.max(...zs);
      for (let lv = lo; lv <= hi; lv += passoZ) {
        const pts = [];
        for (let e = 0; e < 4; e++) { const za = zs[e], zb = zs[(e + 1) % 4]; if ((za - lv) * (zb - lv) < 0) { const f = (lv - za) / (zb - za), [ax, ay] = q[e], [bx, by] = q[(e + 1) % 4]; pts.push(new THREE.Vector3((ax + (bx - ax) * f) * cel - tam / 2, (lv + 0.8) * ex, (ay + (by - ay) * f) * cel - tam / 2)); } }
        if (pts.length >= 2) curvas.push(pts[0], pts[1]);
      }
    }
    t.curvas = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(curvas), new THREE.LineBasicMaterial({ color: 0x5a4122, transparent: true, opacity: 0.38 }));
    t.grupo.add(t.curvas);
    // caminhos da água como fitas que engrossam conforme juntam mais água
    const vs = [];
    for (let c = 0; c < n * n; c++) {
      if (!H.canal(c) || H.dir[c] < 0 || H.borda(c) || H.borda(H.dir[c])) continue;
      const k = H.dir[c], a = pos(c % n, (c / n) | 0, 1.5), b = pos(k % n, (k / n) | 0, 1.5);
      const w = cel * Math.min(1.1, 0.18 + 0.32 * Math.log10(H.acc[c] * H.areaCel / 30000 + 1) * 2);
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, px = -dz / L * w / 2, pz = dx / L * w / 2;
      vs.push(a.x + px, a.y, a.z + pz, a.x - px, a.y, a.z - pz, b.x + px, b.y, b.z + pz, b.x + px, b.y, b.z + pz, a.x - px, a.y, a.z - pz, b.x - px, b.y, b.z - pz);
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute("position", new THREE.Float32BufferAttribute(vs, 3));
    t.canais = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0x1f78b4, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    t.grupo.add(t.canais);
    // gotas com textura redonda e macia
    const sp = document.createElement("canvas"); sp.width = sp.height = 64;
    const sx = sp.getContext("2d"), gr = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
    const NP = 2400, pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    t.gotas = { n: NP, cel: new Int32Array(NP), f: new Float32Array(NP), vida: new Float32Array(NP), geo: pg };
    for (let k = 0; k < NP; k++) nascer(k, true);
    t.pontos = new THREE.Points(pg, new THREE.PointsMaterial({ size: cel * 2.4, map: new THREE.CanvasTexture(sp), vertexColors: true, transparent: true, depthWrite: false }));
    t.grupo.add(t.pontos);
    // chuva
    const NR = 700, rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NR * 6), 3));
    t.chuva = { n: NR, geo: rg, x: new Float32Array(NR), z: new Float32Array(NR), y: new Float32Array(NR), topo: zmax * ex + 320 };
    for (let k = 0; k < NR; k++) { t.chuva.x[k] = (Math.random() - 0.5) * tam; t.chuva.z[k] = (Math.random() - 0.5) * tam; t.chuva.y[k] = Math.random() * t.chuva.topo; }
    t.linhasChuva = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55 }));
    t.grupo.add(t.linhasChuva);
    // marcadores
    t.marcas = [];
    for (const b of H.barreiras) {
      const p = pos(b.c % n, (b.c / n) | 0, 0), cor = b.tipo === "contencao" ? 0xc98a1a : 0x2f7d32;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(cel * 1.3, cel * 1.3, 14 * ex, 20), new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.35 }));
      m.position.copy(p).add(new THREE.Vector3(0, 7 * ex, 0)); m.userData.tipo = b.tipo; t.grupo.add(m); t.marcas.push(m);
      const r = rotulo("b" + b.c, b.tipo === "contencao" ? "Barreira" : "Praça que alaga", b.tipo === "contencao" ? "barreira" : "detencao");
      r.p.copy(m.position).add(new THREE.Vector3(0, 9 * ex, 0)); r.grupo = 4;
    }
    // casinhas na parte baixa: é ali que a enxurrada chega
    const casas = new THREE.Group(); let s0 = 11; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
    const zcorte = zmax * 0.16; let nCasas = 0;
    for (let tent = 0; tent < 6000 && nCasas < 90; tent++) {
      const i = 4 + Math.floor(rnd() * (n - 8)), j = 4 + Math.floor(rnd() * (n - 8)), c = j * n + i;
      if (dem.z[c] > zcorte || H.slope[c] > 0.06 || H.canal(c)) continue;
      const lado = cel * (0.9 + rnd() * 0.6), alt = 7 + rnd() * 5;
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(lado, alt * ex, lado), new THREE.MeshLambertMaterial({ color: rnd() < 0.5 ? 0xd8d2c4 : 0xbfb6a3 }));
      const p = pos(i, j, 0); caixa.position.set(p.x, p.y + alt * ex / 2, p.z); casas.add(caixa);
      const tel = new THREE.Mesh(new THREE.ConeGeometry(lado * 0.75, 4 * ex, 4), new THREE.MeshLambertMaterial({ color: 0x8a4b32 }));
      tel.position.set(p.x, p.y + alt * ex + 2 * ex, p.z); tel.rotation.y = Math.PI / 4; casas.add(tel);
      nCasas++;
    }
    t.grupo.add(casas);
    t.mira = new THREE.Mesh(new THREE.SphereGeometry(cel * 1.3, 24, 16), new THREE.MeshStandardMaterial({ color: 0xff4848, emissive: 0xff2222, emissiveIntensity: 0.6 }));
    t.grupo.add(t.mira);
    const rt = rotulo("topo", `Topo do morro · ${GG.fmt(dem.z[H.topo])} m`); rt.p.copy(pos(H.topo % n, (H.topo / n) | 0, 12)); rt.grupo = 0;
    const rb = rotulo("baixo", "Bairro lá embaixo"); rb.p.copy(pos(H.baixo % n, (H.baixo / n) | 0, 6)); rb.grupo = 0;
    t.dist0 = t.dist = tam * 1.5;
  }

  function nascer(k, espalhar) {
    const g = three.gotas, n = dem.n;
    let c; for (let tries = 0; tries < 4; tries++) { c = (Math.random() * n * n) | 0; if (H.acc[c] < 6 || Math.random() < 0.25) break; }
    g.cel[k] = c; g.f[k] = espalhar ? Math.random() : 0; g.vida[k] = 0;
  }

  // câmera de cada passo
  const CAMS = { 1: { rot: 0.75, inc: 0.95, d: 1.55 }, 2: { rot: 0.85, inc: 0.75, d: 1.35 }, 3: { rot: 0.95, inc: 0.55, d: 1.15 }, 4: { rot: 0.6, inc: 0.85, d: 1.4 } };

  let ultimo = 0;
  function animar(ts) {
    if (!three || !dem) return;
    requestAnimationFrame(animar);
    if (GG.$("#v-morro").hidden) return;
    const dt = Math.min(0.05, (ts - ultimo) / 1000 || 0.016); ultimo = ts;
    const t = three, n = dem.n, ex = P.exag;
    if (t.alvo) { const k = 1 - Math.pow(0.04, dt); t.rot += (t.alvo.rot - t.rot) * k; t.inc += (t.alvo.inc - t.inc) * k; t.dist += (t.alvo.d * t.dist0 / 1.5 - t.dist) * k; }
    t.cam.position.set(Math.sin(t.rot) * Math.cos(t.inc) * t.dist, Math.sin(t.inc) * t.dist, Math.cos(t.rot) * Math.cos(t.inc) * t.dist);
    // no passo 3 a câmera olha para o ponto perigoso, lá embaixo
    const focoAlvo = passo === 3 && sel >= 0 ? t.pos(sel % n, (sel / n) | 0, 0) : new THREE.Vector3(0, 70 * ex, 0);
    t.foco = t.foco ? t.foco.lerp(focoAlvo, 1 - Math.pow(0.05, dt)) : focoAlvo.clone();
    t.cam.position.add(t.foco.clone().multiplyScalar(passo === 3 ? 0.6 : 0));
    t.cam.lookAt(t.foco);
    // visibilidade por passo
    t.canais.visible = passo >= 2; t.pontos.visible = passo >= 2; t.linhasChuva.visible = passo <= 3;
    t.marcas.forEach((m) => { m.visible = passo === 4; });
    t.mira.visible = sel >= 0;
    t.canais.material.opacity = passo === 2 ? 0.95 : 0.7;
    // gotas
    if (t.pontos.visible) {
      const g = t.gotas, pa = g.geo.attributes.position.array, ca = g.geo.attributes.color.array, fator = P.chuva / 60 * USO[P.uso].C / 0.85;
      const lento = passo === 2;
      for (let k = 0; k < g.n; k++) {
        let c = g.cel[k], d = H.dir[c];
        if (d < 0) { nascer(k); continue; }
        const v = 0.6 + 4.5 * Math.pow(H.acc[c] * H.areaCel / 30000, 0.28) * Math.sqrt(H.slope[c]) * fator;
        g.f[k] += v * dt * (lento ? 3 : 6) / dem.cel; g.vida[k] += dt;
        while (g.f[k] >= 1) { g.f[k] -= 1; c = d; d = H.dir[c]; if (d < 0) break; }
        if (d < 0 || g.vida[k] > 16) { nascer(k); continue; }
        g.cel[k] = c;
        const a = t.pos(c % n, (c / n) | 0, 3), b = t.pos(d % n, (d / n) | 0, 3), f = g.f[k];
        pa[k * 3] = a.x + (b.x - a.x) * f; pa[k * 3 + 1] = a.y + (b.y - a.y) * f; pa[k * 3 + 2] = a.z + (b.z - a.z) * f;
        const q = passo === 2 ? 0 : Math.min(1, (v - 0.6) / 4.2);
        ca[k * 3] = q < 0.5 ? 0.35 + q * 1.3 : 1; ca[k * 3 + 1] = q < 0.5 ? 0.75 + q * 0.5 : 1 - (q - 0.5) * 1.7; ca[k * 3 + 2] = q < 0.5 ? 1 : 1 - (q - 0.5) * 1.9;
      }
      g.geo.attributes.position.needsUpdate = true; g.geo.attributes.color.needsUpdate = true;
    }
    if (t.linhasChuva.visible) {
      const r = t.chuva, rp = r.geo.attributes.position.array, vel = 320 + P.chuva * 6;
      for (let k = 0; k < r.n; k++) {
        r.y[k] -= vel * dt; if (r.y[k] < 0) { r.y[k] = r.topo; r.x[k] = (Math.random() - 0.5) * t.tam; r.z[k] = (Math.random() - 0.5) * t.tam; }
        rp.set([r.x[k], r.y[k], r.z[k], r.x[k] + 3, r.y[k] + 30, r.z[k]], k * 6);
      }
      r.geo.attributes.position.needsUpdate = true;
    }
    if (sel >= 0) { t.mira.position.copy(t.pos(sel % n, (sel / n) | 0, 6)); t.mira.scale.setScalar(1 + 0.15 * Math.sin(ts / 220)); }
    t.renderer.render(t.scene, t.cam);
    const W = t.host.clientWidth, Hh = t.host.clientHeight;
    const caixas = []; // etiquetas não se sobrepõem: a que se cruzar com outra já posta fica escondida
    for (const r of Object.values(t.rotulos)) {
      const mostrar = r.grupo === 0 ? passo !== 4 : r.grupo === passo;
      const p = r.p.clone().project(t.cam);
      const x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * Hh;
      let esconder = !mostrar || p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05;
      if (!esconder) {
        const w = r.el.offsetWidth || 120, h = r.el.offsetHeight || 30, c = [x - w / 2 - 4, y - h - 12, x + w / 2 + 4, y - 4];
        if (caixas.some((o) => c[0] < o[2] && c[2] > o[0] && c[1] < o[3] && c[3] > o[1])) esconder = true; else caixas.push(c);
      }
      r.el.hidden = esconder;
      r.el.style.left = x + "px"; r.el.style.top = y + "px";
    }
  }

  function clicar(e) {
    const t = three, r = t.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(v, t.cam);
    const hit = ray.intersectObject(t.terreno)[0];
    if (!hit) return;
    const n = dem.n, i = Math.round((hit.point.x + t.tam / 2) / dem.cel), j = Math.round((hit.point.z + t.tam / 2) / dem.cel);
    if (i < 0 || j < 0 || i >= n || j >= n) return;
    let best = j * n + i;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = i + dx, y = j + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue; const c = y * n + x; if (H.acc[c] > H.acc[best]) best = c; }
    sel = best;
    if (passo !== 3) irPasso(3); else { painel(); legenda(); }
  }

  // ── textos ──────────────────────────────────────────────────────────
  const PASSOS = [
    [1, "A chuva cai"], [2, "A água se junta"], [3, "Desce com força"], [4, "Onde barrar"],
  ];
  function legenda() {
    const f = fisica(sel), campos = f.A / CAMPO_M2, kmh = f.v * 3.6, np = nivelPerigo(f.vh, f.h);
    const efeito = ["molha os pés", "derruba criança e idoso", "derruba um adulto", "arrasta um carro"][np];
    const txt = {
      1: `A chuva cai no morro inteiro ao mesmo tempo. Com ${P.chuva} mm em uma hora, cada campo de futebol recebe uns <b>${GG.fmt(P.chuva * CAMPO_M2 / 1000, 0)} mil litros</b> de água.`,
      2: `Asfalto e telhado não bebem água. Ela corre morro abaixo e se junta nas ravinas e nas ruas, <b>como num funil</b>. As linhas azuis mostram esses caminhos.`,
      3: `No ponto vermelho passa a água de <b>${GG.fmt(campos, 0)} campos de futebol</b> de morro. Ela chega a <b>${GG.fmt(kmh, 0)} km/h</b>, com ${GG.fmt(f.h * 100, 0)} cm de altura: força que <b>${efeito}</b>. Gota vermelha é água mais rápida.`,
      4: `<b>Barreiras</b> nas ravinas seguram a água e a terra. <b>Praças que podem alagar</b> no pé do morro guardam a água por algumas horas. E a mata nas encostas mais íngremes (em laranja) precisa ficar onde está.`,
    }[passo];
    GG.$("#legenda-morro").innerHTML = txt;
    const r = three.rotulos.perigo || rotulo("perigo", "", "perigo");
    r.el.textContent = `Aqui: ${GG.fmt(kmh, 0)} km/h`; r.p.copy(three.pos(sel % dem.n, (sel / dem.n) | 0, 14)); r.grupo = 3;
  }
  function painel() {
    const f = fisica(sel), kmh = f.v * 3.6, np = nivelPerigo(f.vh, f.h);
    const icones = [
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16c2 0 2-1.5 4-1.5S10 16 12 16s2-1.5 4-1.5 2 1.5 4 1.5"/></svg>`,
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path d="M12 7v6M9 21l3-8 3 8M8 10h8"/><path d="M15 13l2 3"/></svg>`,
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M12 6v7M8 21l4-8 4 8M7 9h10"/></svg>`,
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 15l2-5h14l2 5v3H3z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>`,
    ];
    const rot = ["Molha os pés", "Derruba criança e idoso", "Derruba adulto", "Arrasta carro"];
    const cores = ["var(--accent)", "var(--warn)", "var(--alert)", "var(--crit)"];
    GG.$("#morro-fisica").innerHTML = `
      <h3>No ponto vermelho</h3>
      <div class="linha" style="gap:24px">
        <div><div class="numero" style="color:${cores[np]}">${GG.fmt(kmh, 0)} km/h</div><span class="mut">velocidade da água</span></div>
        <div><div class="numero">${GG.fmt(f.h * 100, 0)} cm</div><span class="mut">de altura</span></div>
      </div>
      <div class="escala-perigo">${rot.map((r, i) => `<div class="${i === np ? "on" : ""}" style="color:${cores[i]}">${icones[i]}<span style="color:var(--fg)">${r}</span></div>`).join("")}</div>
      <p>A água chega aqui <b>${GG.fmt(Math.max(2, f.tc), 0)} minutos</b> depois de começar a chover forte.</p>
      <p class="mut peq">Toque em outro lugar do morro para medir.</p>`;
    GG.$("#morro-tecnico").innerHTML = `Área de contribuição ${GG.fmt(f.A / 1e4, 1)} ha · vazão ${GG.fmt(f.Q, 2)} m³/s · declividade ${GG.fmt(f.S * 100, 0)}% · lâmina ${GG.fmt(f.h * 100, 0)} cm em seção de ${P.uso === "mata" ? 3 : 8} m (Manning n=${USO[P.uso].n}) · velocidade ${GG.fmt(f.v, 1)} m/s · v×h ${GG.fmt(f.vh, 2)} m²/s · empurrão ${GG.fmt(f.forca / 9.81, 0)} kgf por metro · tempo de concentração (Kirpich) ${GG.fmt(f.tc, 0)} min · coeficiente de escoamento ${USO[P.uso].C} · relevo ${dem.real ? `real ~${GG.fmt(dem.cel, 0)} m` : "de exemplo"}. Sugestões de barreira são candidatas para estudo de engenharia, não projeto.`;
  }

  function irPasso(k) {
    passo = k;
    GG.$$("#passos-morro button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.p === passo));
    if (passo === 3 && sel >= 0 && dem) {
      const p = three.pos ? three.pos(sel % dem.n, (sel / dem.n) | 0, 0) : null;
      three.alvo = p ? { rot: Math.atan2(p.x, p.z), inc: 0.6, d: 1.15 } : CAMS[3];
    } else three.alvo = CAMS[passo];
    construir();
    legenda(); painel();
  }

  async function carregar(id) {
    const m = GG.CONFIG.morros.find((x) => x.id === id) || GG.CONFIG.morros[0];
    GG.$("#morro-status").innerHTML = `<span class="tag mut" style="background:var(--panel)">Carregando o relevo…</span>`;
    try { dem = await carregarReal(m); } catch { dem = didatico("Morro de exemplo"); }
    dem.ref = m;
    H = analisar(dem);
    sel = H.perigoso;
    irPasso(passo);
    GG.$("#morro-status").innerHTML = dem.real
      ? `<span class="tag ok" style="background:var(--panel)">${GG.esc(m.nome)} · relevo real</span>`
      : `<span class="tag demo" style="background:var(--panel)" title="O relevo real de ${GG.esc(m.nome)} aparece no app publicado.">Morro de exemplo</span>`;
    GG.$("#morro-earth").href = `https://earth.google.com/web/@${m.lat},${m.lon},150a,${Math.round(m.raio * 2600)}d,35y,0h,60t,0r`;
  }

  function kml() {
    const m = dem.ref, n = dem.n;
    if (!dem.real) return GG.toast("O arquivo para o Google Earth usa o relevo real. Disponível no app publicado.", "erro");
    const ll = (c) => [dem.bbox[0] + (dem.bbox[2] - dem.bbox[0]) * (c % n) / (n - 1), dem.bbox[3] - (dem.bbox[3] - dem.bbox[1]) * ((c / n) | 0) / (n - 1)];
    const temCima = new Uint8Array(n * n); for (let u = 0; u < n * n; u++) if (H.canal(u) && H.dir[u] >= 0) temCima[H.dir[u]] = 1;
    const vist = new Uint8Array(n * n), linhas = [];
    for (let c0 = 0; c0 < n * n; c0++) { if (!H.canal(c0) || temCima[c0]) continue; const l = []; let c = c0; while (c >= 0 && !vist[c]) { vist[c] = 1; l.push(ll(c)); c = H.dir[c]; } if (c >= 0) l.push(ll(c)); if (l.length > 1) linhas.push(l); }
    const pm = H.barreiras.map((b) => { const p = ll(b.c); return `<Placemark><name>${b.tipo === "contencao" ? "Barreira sugerida" : "Praça que pode alagar"}</name><Point><coordinates>${p[0]},${p[1]},0</coordinates></Point></Placemark>`; }).join("");
    const ls = linhas.map((l) => `<Placemark><styleUrl>#canal</styleUrl><LineString><tessellate>1</tessellate><coordinates>${l.map((p) => p.join(",")).join(" ")}</coordinates></LineString></Placemark>`).join("");
    GG.baixar(`guga-${m.id}.kml`, `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>GuGa · ${m.nome}</name><Style id="canal"><LineStyle><color>ffe69f2f</color><width>3</width></LineStyle></Style>${ls}${pm}</Document></kml>`, "application/vnd.google-earth.kml+xml");
  }

  function iniciar() {
    GG.$("#passos-morro").innerHTML = PASSOS.map(([k, r]) => `<button data-p="${k}" aria-pressed="${k === passo}"><b>${k}</b>${r}</button>`).join("");
    GG.$$("#passos-morro button").forEach((b) => b.onclick = () => { passo = +b.dataset.p; GG.$$("#passos-morro button").forEach((x) => x.setAttribute("aria-pressed", x === b)); if (three && dem) irPasso(passo); });
    const s = GG.$("#morro-sel");
    s.innerHTML = GG.CONFIG.morros.map((m) => `<option value="${m.id}">${GG.esc(m.nome)}</option>`).join("");
    s.onchange = () => carregar(s.value);
    GG.$("#m-chuva").oninput = (e) => { P.chuva = +e.target.value; GG.$("#m-chuva-v").textContent = P.chuva + " mm por hora"; if (H) { legenda(); painel(); } };
    GG.$$("[name=m-uso]").forEach((r) => r.onchange = () => { P.uso = r.value; if (H) { legenda(); painel(); } });
    GG.$("#morro-kml").onclick = kml;
  }
  async function mostrar() {
    if (iniciado) return;
    iniciado = true;
    if (!window.THREE) { GG.$("#morro-status").innerHTML = `<span class="tag crit">O 3D não carregou neste aparelho.</span>`; return; }
    three = montarCena();
    await carregar(GG.$("#morro-sel").value);
    requestAnimationFrame(animar);
  }

  return { iniciar, mostrar, _analisar: analisar, _didatico: didatico };
})();
