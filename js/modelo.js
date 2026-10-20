/* GuGa · tipos de relato, estados e a fórmula de priorização de resgate (pública e explicável). */
GG.modelo = (() => {
  const TIPOS = {
    bueiro: {
      rotulo: "Bueiro / boca de lobo", grupo: "bueiro",
      subs: {
        ok: { rotulo: "Limpo, funcionando", problema: false },
        entupido: { rotulo: "Entupido (lixo, folhas, terra)", problema: true },
        sem_tampa: { rotulo: "Sem tampa / grade quebrada", problema: true },
        transbordando: { rotulo: "Devolvendo água / transbordando", problema: true },
        coberto: { rotulo: "Coberto por obra, carro ou entulho", problema: true },
      },
    },
    situacao: {
      rotulo: "Como está este lugar", grupo: "situacao",
      subs: {
        seguro: { rotulo: "Este lugar é seguro", problema: false },
        ponto_seguro: { rotulo: "Ponto de apoio seguro (abrigo, ponto de encontro)", problema: false },
        inundando: { rotulo: "Está inundando agora", problema: true },
        inundado: { rotulo: "Está inundado", problema: true },
        inseguro: { rotulo: "Ponto NÃO seguro (correnteza, deslizamento, fio caído)", problema: true },
      },
    },
    sos: { rotulo: "Preciso de ajuda urgente", grupo: "sos", subs: { pessoas: { rotulo: "Pessoas precisam de resgate", problema: true } } },
    animais: { rotulo: "Animais precisam de ajuda", grupo: "sos", subs: { animais: { rotulo: "Animais ilhados ou presos", problema: true } } },
  };

  const ESTADOS = {
    aberto: { rotulo: "Recebido · não verificado", cor: "warn" },
    verificado: { rotulo: "Verificado pela equipe GuGa", cor: "crit" },
    em_atendimento: { rotulo: "Em atendimento", cor: "info" },
    resolvido: { rotulo: "Resolvido", cor: "ok" },
    rejeitado: { rotulo: "Rejeitado na revisão", cor: "mut" },
  };

  const AGUA = [
    { id: "seco", rotulo: "Ainda seco", pts: 0 },
    { id: "canela", rotulo: "Na canela", pts: 5 },
    { id: "joelho", rotulo: "No joelho", pts: 12 },
    { id: "cintura", rotulo: "Na cintura", pts: 22 },
    { id: "peito", rotulo: "No peito", pts: 32 },
    { id: "telhado", rotulo: "Estamos no telhado / andar de cima", pts: 45 },
  ];
  const ESPECIES = ["cães", "gatos", "cavalos", "gado", "aves", "outros"];

  const problema = (r) => !!TIPOS[r.tipo]?.subs[r.sub]?.problema;
  const ativo = (r) => r.status !== "resolvido" && r.status !== "rejeitado";

  /**
   * Prioridade de resgate (0–200+). Regra aberta, publicada no painel de transparência.
   * Pesos pensados com base em grupos vulneráveis em enchentes; ajustar com Defesa Civil e Bombeiros.
   */
  function prioridade(r, agora = Date.now()) {
    if (r.tipo !== "sos" && r.tipo !== "animais") return { total: 0, partes: [] };
    const s = r.sos || {};
    const partes = [];
    const add = (rot, v) => { if (v) partes.push([rot, Math.round(v)]); };
    if (r.tipo === "sos") {
      add("Pedido de resgate de pessoas", 50);
      add(`${s.pessoas || 1} pessoa(s)`, Math.min(40, 4 * (s.pessoas || 1)));
      add("Bebê ou criança", (s.criancas || 0) > 0 ? 20 : 0);
      add("Idoso", (s.idosos || 0) > 0 ? 20 : 0);
      add("Acamado, deficiência ou doente", s.pcd ? 25 : 0);
      add("Gestante", s.gestante ? 15 : 0);
      add("Sem remédio essencial", s.semRemedio ? 10 : 0);
      add(`${s.animais || 0} animal(is) junto`, Math.min(10, s.animais || 0));
    } else {
      add("Pedido de resgate de animais", 15);
      add(`${s.animais || 1} animal(is)`, Math.min(25, 2 * (s.animais || 1)));
    }
    const ag = AGUA.find((a) => a.id === s.agua);
    add(`Água: ${ag?.rotulo?.toLowerCase() || "não informada"}`, ag ? (r.tipo === "animais" ? ag.pts / 2 : ag.pts) : 0);
    const horas = (agora - new Date(r.criadoEm).getTime()) / 3.6e6;
    add(`Esperando há ${Math.max(0, Math.round(horas))} h`, Math.min(30, Math.max(0, horas) * 2));
    add(`${r.confirmacoes || 0} confirmação(ões) de vizinhos`, Math.min(10, 2 * (r.confirmacoes || 0)));
    return { total: partes.reduce((a, p) => a + p[1], 0), partes };
  }

  function faixaPrioridade(total) {
    if (total >= 130) return { rot: "CRÍTICA", cls: "crit" };
    if (total >= 95) return { rot: "ALTA", cls: "alert" };
    if (total >= 60) return { rot: "MÉDIA", cls: "warn" };
    return { rot: "BAIXA", cls: "info" };
  }

  // Exemplos SÓ para demonstração visual, gerados no navegador e marcados como DEMO. Nunca gravados.
  function exemplos() {
    const base = Date.now();
    const h = (n) => new Date(base - n * 3.6e6).toISOString();
    const E = (id, tipo, sub, lon, lat, bairro, extra = {}) => ({ id: "demo-" + id, demo: true, tipo, sub, lon, lat, bairro, cidade: "Porto Alegre", status: "aberto", confirmacoes: 0, criadoEm: h(2), descricao: "", fotos: [], ...extra });
    return [
      E(1, "bueiro", "entupido", -51.2236, -30.0402, "Cidade Baixa", { confirmacoes: 4, cobrancas: 11, criadoEm: h(30), descricao: "Grade tomada de folhas e garrafas na esquina.", protocolos: [{ orgao: "prefeitura", numero: "EXEMPLO-0001", em: h(26) }] }),
      E(2, "bueiro", "entupido", -51.2189, -30.0447, "Cidade Baixa", { status: "verificado", criadoEm: h(52) }),
      E(3, "bueiro", "sem_tampa", -51.2297, -30.0570, "Menino Deus", { confirmacoes: 2, criadoEm: h(80), conserto: { em: h(4) } }),
      E(4, "bueiro", "ok", -51.2155, -30.0371, "Cidade Baixa", { status: "resolvido", criadoEm: h(100), resolvidoEm: h(20) }),
      E(5, "bueiro", "transbordando", -51.2066, -30.0016, "Navegantes", { criadoEm: h(5) }),
      E(6, "bueiro", "ok", -51.2350, -30.0610, "Menino Deus"),
      E(7, "bueiro", "coberto", -51.1955, -30.0005, "São João", { status: "em_atendimento", criadoEm: h(26) }),
      E(8, "bueiro", "entupido", -51.1748, -29.9930, "Humaitá", { criadoEm: h(12) }),
      E(9, "situacao", "seguro", -51.1820, -30.0283, "Petrópolis"),
      E(10, "situacao", "inundando", -51.2058, -29.9935, "Navegantes", { confirmacoes: 6, criadoEm: h(1) }),
      E(11, "situacao", "inseguro", -51.2266, -30.0313, "Centro Histórico", { descricao: "Fio caído na calçada." }),
      E(12, "situacao", "ponto_seguro", -51.2120, -30.0350, "Bom Fim", { descricao: "Ginásio aberto como ponto de apoio." }),
      E(13, "sos", "pessoas", -51.1900, -29.9880, "Humaitá", { criadoEm: h(3), sos: { pessoas: 4, criancas: 1, idosos: 1, pcd: false, agua: "cintura", animais: 2, especies: ["cães"] } }),
      E(14, "sos", "pessoas", -51.2010, -29.9965, "Navegantes", { criadoEm: h(1.5), sos: { pessoas: 2, idosos: 2, pcd: true, agua: "joelho", semRemedio: true } }),
      E(15, "animais", "animais", -51.1838, -29.9905, "Humaitá", { criadoEm: h(6), sos: { animais: 7, especies: ["cães", "gatos"], agua: "cintura" } }),
    ];
  }

  return { TIPOS, ESTADOS, AGUA, ESPECIES, prioridade, faixaPrioridade, problema, ativo, exemplos };
})();
