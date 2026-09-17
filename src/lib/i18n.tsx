import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

export type Locale = "pt" | "en";
export type Theme = "light" | "dark";

type CopyKey = "home" | "products" | "store" | "agents" | "services" | "support" | "dashboard" | "signOut" | "getStarted" | "commandCenter" | "refresh" | "live" | "connecting" | "offline" | "themeLight" | "themeDark" | "language";

const copy: Record<Locale, Record<CopyKey, string>> = {
  pt: { home: "Início", products: "Produtos", store: "Loja", agents: "Agentes IA", services: "Serviços", support: "Suporte", dashboard: "Dashboard", signOut: "Sair", getStarted: "Começar", commandCenter: "Abrir central", refresh: "Atualizar", live: "Ao vivo", connecting: "A ligar…", offline: "Offline", themeLight: "Tema claro", themeDark: "Tema noturno", language: "Idioma" },
  en: { home: "Home", products: "Products", store: "Store", agents: "AI agents", services: "Services", support: "Support", dashboard: "Dashboard", signOut: "Sign out", getStarted: "Get started", commandCenter: "Open command center", refresh: "Refresh", live: "Live", connecting: "Connecting…", offline: "Offline", themeLight: "Light theme", themeDark: "Dark theme", language: "Language" },
};

type Preferences = { locale: Locale; theme: Theme };
const defaults: Preferences = { locale: "pt", theme: "dark" };

const PreferencesContext = createContext<Preferences & { setLocale: (locale: Locale) => void; toggleTheme: () => void; t: (key: CopyKey) => string } | null>(null);

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem("fontes-preferences") ?? "null") as Partial<Preferences> | null;
    return { locale: stored?.locale === "en" ? "en" : defaults.locale, theme: stored?.theme === "light" ? "light" : defaults.theme };
  } catch { return defaults; }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  useEffect(() => setPreferences(readPreferences()), []);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = preferences.locale === "pt" ? "pt-PT" : "en";
    localStorage.setItem("fontes-preferences", JSON.stringify(preferences));
  }, [preferences]);
  const value = useMemo(() => ({ ...preferences, setLocale: (locale: Locale) => setPreferences((current) => ({ ...current, locale })), toggleTheme: () => setPreferences((current) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" })), t: (key: CopyKey) => copy[preferences.locale][key] }), [preferences]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}

/**
 * Idioma da interface — PT por defeito (Angola/Portugal), EN opcional.
 * Sem dependências externas: store global + useSyncExternalStore,
 * persistido em localStorage e sincronizado com <html lang>.
 */

export type Lang = "pt" | "en";

const STORAGE_KEY = "fontes-lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "pt" || saved === "en") return saved;
  } catch {
    /* SSR / storage bloqueado — usa o defeito */
  }
  return "pt";
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignora */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang === "pt" ? "pt" : "en";
  }
  for (const fn of listeners) fn();
}

export function toggleLang() {
  setLang(current === "pt" ? "en" : "pt");
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Assina o idioma atual (re-render quando muda). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

// ============================================================
// Dicionário — PT é a fonte da verdade; EN tem de ter a mesma forma.
// ============================================================

const pt = {
  nav: {
    home: "Início",
    products: "Produtos",
    store: "Loja",
    agents: "Agentes IA",
    services: "Serviços",
    support: "Suporte",
    dashboard: "Dashboard",
    signOut: "Terminar sessão",
    getStarted: "Começar",
    openCC: "Abrir o centro de comando",
    cc: "Centro de comando",
    toggleMenu: "Alternar menu",
  },
  lang: {
    label: "Idioma",
    pt: "Português",
    en: "English",
    switch: "Mudar para inglês",
  },
  agents: {
    names: {
      lead_qualifier: "Qualificador de Leads",
      insight_engine: "Motor de Insights",
      error_handler: "Gestor de Erros",
      growth_marketing: "Agente de Crescimento & Marketing",
      ai_teacher: "Professor IA",
      ai_manager: "Gestor IA",
      skills_scout: "Olheiro de Skills",
    },
  },
  ops: {
    menu: "Operações",
    sub: "O Gestor IA comanda a equipa: missões diárias, venda automática de packs, garantia de qualidade e skills novas do ecossistema skills.sh.",
    managerCard: "Gestor IA",
    managerRole: "Diretor de operações · comanda a equipa de IA sem aprovação administrativa",
    schedule: "Diário 05:30 UTC · GitHub Actions",
    missionsTitle: "Missões do dia",
    missionsSub: "Atribuídas automaticamente a cada agente a partir de dados reais",
    objective: "Objetivo",
    directive: "Diretiva",
    bottleneck: "Gargalo",
    assignedBy: "Atribuído pelo Gestor IA",
    noMissions: "Sem missões ainda — o Gestor IA executa todos os dias às 05:30 UTC",
    qaTitle: "Garantia de qualidade de entregas",
    qaSub: "Cada pack vendido é registado automaticamente e verificado pelo Gestor de Erros",
    qaPending: "Por verificar",
    qaPassed: "Aprovados",
    qaFailed: "Reprovados",
    qaClient: "Cliente",
    qaPack: "Pack",
    qaChecks: "Verificações",
    qaVerified: "Verificado",
    qaAwaiting: "À espera do primeiro ciclo de QA",
    checksLabels: {
      order_paid: "Pedido pago",
      client_registered: "Cliente registado",
      amount_matches_pack: "Valor compatível com o pack",
      product_operational: "Produto operacional",
    },
    skillsTitle: "Skills do ecossistema (skills.sh)",
    skillsSub: "O Olheiro de Skills busca comandos e prompts que cada agente precisa e entrega-lhos na memória",
    skillsAgent: "Agente",
    skillsFound: "Skills encontradas",
    skillsRecommended: "Recomendada",
    skillsInstructions: "Instruções obtidas",
    skillsNone: "Sem skills novas — o Olheiro corre todos os dias às 05:30 UTC",
    ecosystem: "Ecossistema",
    howTitle: "Ciclo de operações autónomo",
    step1: "05:30 — O Gestor IA lê os dados reais e atribui missões a cada agente.",
    step2: "05:30 — O Olheiro de Skills busca em skills.sh as técnicas que a equipa precisa.",
    step3: "06:00 — Os agentes executam as missões: qualificar, campanhas, insights.",
    step4: "De hora a hora — QA: cada pack vendido é verificado como funcional para o cliente.",
  },
  academy: {
    tabAgents: "Agentes",
    tabAcademy: "Academia IA",
    sub: "O Professor IA estuda o mercado real e ensina os outros agentes sozinho — sem aprovação administrativa.",
    teacherCard: "Professor IA",
    teacherRole: "Docente · estuda dados reais de mercado e escreve as lições",
    schedule: "Diário 06:00 UTC · GitHub Actions",
    runs: "Aulas dadas",
    briefs: "Lições escritas",
    lastClass: "Última aula",
    noClass: "Ainda sem aulas — à espera do primeiro ciclo agendado",
    autonomy: "100% autónomo: lê os dados reais e atualiza as lições sozinho",
    autonomyBadge: "Autónomo",
    studentsTitle: "Alunos",
    studentsSub: "Cada agente segue um currículo próprio de competências de venda",
    graduation: {
      enrolled: "Inscrito",
      in_training: "Em formação",
      trained: "Formado",
    },
    briefTitle: "Briefing de mercado atual",
    noBrief: "Sem briefing ainda — o Professor IA escreve um a cada ciclo",
    freshness: { fresh: "Atual", aging: "A envelhecer", stale: "Desatualizado" },
    skills: "Competências",
    lessons: "Lições na memória",
    marketState: "Estado do mercado",
    instruction: "Instrução",
    focusSkills: "Foco",
    avoid: "Evitar",
    briefDate: "Lição de",
    howTitle: "Como a Academia funciona",
    step1: "O Professor IA lê os dados reais do funil (leads, clientes, receita) — nada simulado.",
    step2: "Diagnostica as lacunas de conhecimento de cada agente e o que ficou desatualizado.",
    step3: "Escreve um briefing de mercado individual na memória de cada agente.",
    step4: "Na próxima execução agendada, cada agente aplica a lição ao vender — sozinho.",
  },
  hero: {
    sticker: "Sistema de comando Humano + IA · apenas dados reais",
    kicker: "FONTES / ADMIN ADJUNTA IA",
    title1: "O teu negócio, a funcionar",
    titleAccent: "sozinho",
    sub: "O Fontes Admin Adjunta IA transforma pesquisa aprovada em pacotes de produto, qualifica oportunidades de compra e mantém cada ação auditável — com outreach limitado a canais consentidos e dados reais quando ligado.",
    ctaPrimary: "Começar grátis",
    ctaSecondary: "Ver dashboard ao vivo",
    noticeTitle: "Apenas dados comerciais reais",
    noticeBody: "Métricas, preços, disponibilidade e resultados só aparecem depois de existirem na fonte de dados ligada. Sem números de demonstração.",
  },
  features: {
    title: "Um ecossistema, não um dashboard",
    sub: "Seis sistemas a trabalhar juntos para o trabalho administrativo acontecer enquanto dormes.",
    leads: { title: "Enxame de Caça-Leads", desc: "Agentes de pesquisa só apresentam leads quando uma fonte autorizada estiver ligada e cada registo for verificável." },
    sales: { title: "Autómato de Vendas", desc: "A análise de sinais e a criação de propostas ficam indisponíveis até existirem dados reais e uma fonte autorizada." },
    clients: { title: "Centro de Comando de Clientes", desc: "Cada cliente, plano, MRR e risco de churn numa só vista. O motor recomenda a próxima melhor ação por conta." },
    data: { title: "Dados de Negócio ao Vivo", desc: "Leads, pedidos e receita reais — guardados em Postgres Supabase com segurança ao nível da linha. Sem folhas de cálculo." },
    payments: { title: "Pagamentos com Garantias", desc: "Os pedidos e pagamentos só são apresentados após configuração de um provedor real e confirmação verificável; sem cobrança automática nesta versão." },
    security: { title: "Segurança de Nível Bancário", desc: "Segurança ao nível da linha em todas as tabelas, TLS 1.3 em trânsito, AES-256 em repouso. Os teus dados de negócio são teus." },
  },
  eco: {
    market: "Mercado",
    marketDesc: "Sinais e preços apenas de fontes ligadas",
    agents: "Agentes IA",
    agentsDesc: "Pesquisa, vendas e produto com auditoria",
    projects: "Projetos",
    projectsDesc: "Operação humana com controlo administrativo",
  },
  lab: {
    badge: "Laboratório visual",
    title: "Seis identidades. Um ecossistema vivo.",
    sub: "Escolhe uma direção para cada superfície. A implementação atual combina Neon Anime Punk no website com Cyber Market Command na APP.",
    active: "Direção ativa: híbrida",
    items: [
      ["Fontes Pulse", "F geométrico, linhas de energia e pulso ciano/magenta.", "Website accent"],
      ["AI Human Core", "Rosto humano e circuito para confiança e proximidade.", "Trust layer"],
      ["Neon Orbit", "Órbita luminosa para IA, agentes e dados conectados.", "Motion system"],
      ["Anime Visor", "Emblema futurista, scanlines e glitch subtil.", "Campaign mode"],
      ["Command Mark", "Monograma modular com estados de operação reais.", "Admin active"],
      ["Dual Identity", "Fontes artístico; Admin Adjunta IA técnico e operacional.", "Selected hybrid"],
    ],
    tags: "Website Neon Anime Punk · dashboard Cyber Market Command · checkout Human-Tech · prefers-reduced-motion · apenas dados reais",
  },
  how: {
    badge: "Como funciona",
    title: "De desconhecido a contrato assinado — no piloto automático",
    steps: [
      ["Caçar", "Os bots analisam os teus nichos diariamente e capturam leads com empresa, contacto e pontuação."],
      ["Qualificar", "O motor pontua cada lead e encaminha os quentes diretamente para o pipeline."],
      ["Fechar", "O autómato de vendas redige a proposta e acompanha o pedido da referência ao pagamento."],
      ["Reter", "O centro de comando monitoriza MRR, risco de churn e próximas melhores ações por cliente."],
    ],
    previewLabel: "Pré-visualização do fluxo",
    previewTitle: "Atividade ao vivo indisponível",
    previewBody: "Atividade, vendas e leads serão apresentados aqui apenas quando existirem na base de dados ligada.",
    liveTag: "dados ao vivo indisponíveis",
  },
  pricing: {
    title: "Preços",
    sub: "Liga a tua base de dados e começa a ganhar. Os bots já estão à espera de trabalhar por ti.",
    popular: "Mais popular",
    users: { starter: "10 utilizadores", professional: "50 utilizadores", enterprise: "Utilizadores ilimitados" },
    period: "/mês",
    starter: {
      features: ["Caça-leads (diário)", "Dashboard de vendas", "Suporte por email", "1 fluxo de automação"],
      cta: "Começar com Starter",
    },
    professional: {
      features: ["Enxame caça-leads (24/7)", "Autómato de vendas + propostas", "Centro de comando de clientes", "Suporte prioritário WhatsApp", "Fluxos de automação ilimitados"],
      cta: "Avançar para Professional",
    },
    enterprise: {
      features: ["Tudo no Professional", "Agentes IA personalizados para o teu nicho", "Gestor de sucesso dedicado", "SLA 99,98% + registos de auditoria"],
      cta: "Falar com vendas",
    },
  },
  cta: {
    title: "Deixa os bots trabalhar enquanto dormes",
    body: "Compras e pagamentos reais exigem um provedor configurado e confirmação verificável. Sem dados de demonstração.",
    button: "Pedir a tua demonstração",
  },
  auth: {
    welcome: "Bem-vindo de volta",
    create: "Cria a tua conta",
    signinSub: "Entra no teu centro de comando de administração IA.",
    signupSub: "Começa a automatizar as tuas vendas em minutos.",
    email: "Email",
    password: "Password",
    signIn: "Entrar",
    signUp: "Criar conta",
    wait: "Um momento…",
    noAccount: "Ainda sem conta?",
    signupLink: "Registar",
    hasAccount: "Já registado?",
    signinLink: "Entrar",
    back: "← Voltar ao início",
    dbNotice: "As contas reais exigem a ligação à base de dados. Segue os passos de configuração no dashboard.",
    errEmail: "Introduz um email válido.",
    errPassword: "A password precisa de pelo menos 8 caracteres.",
    errDb: "As contas estão desativadas até a base de dados estar ligada (ver passos de configuração no dashboard).",
    errGeneric: "Algo correu mal",
  },
  footer: {
    tag: "A administração IA autónoma que caça leads, fecha vendas e gere as operações do teu negócio 24/7.",
    contact: "Contacto",
    payments: "Pagamentos: Multicaixa Express · PayPay ·",
    paymentsLink: "Contas USD/EUR",
    company: "Empresa",
    rights: "© 2026 · Todos os direitos reservados",
    terms: "Termos comerciais publicados quando disponíveis",
  },
  setup: {
    title: "Ligação à base de dados necessária",
    sub: "Esta app funciona apenas com dados reais — sem modo demo, sem simulações.",
    alert: "O espaço de trabalho Supabase ao vivo não está ligado nesta implantação, pelo que os dados autenticados, a persistência e a entrega autónoma estão pausados. Não são mostrados leads, compradores ou outreach falsos.",
    hint: "Podes rever o fluxo de pacotes de produto a partir da pré-visualização pública. Liga o Supabase e executa as migrações do repositório quando estiveres pronto para ativar armazenamento real, execuções de agentes e outreach com consentimento.",
  },
  leadForm: {
    title: "Vê o teu negócio em piloto automático",
    sub: "Conta-nos sobre a tua empresa — voltamos com um plano de automação personalizado.",
    company: "Empresa",
    name: "O teu nome",
    email: "Email profissional",
    niche: "O teu nicho",
    nicheSaaS: "SaaS / Tecnologia",
    nicheFintech: "Fintech / Finanças",
    nicheHealth: "Saúde",
    nicheEcom: "E-commerce / Retalho",
    nicheLogistics: "Logística",
    nicheAgencies: "Agências / Serviços",
    send: "Pedir auditoria de automação grátis",
    sending: "A enviar…",
    doneTitle: "Pedido recebido!",
    doneBody: "O teu pedido é agora um lead real no nosso sistema. A qualificação só acontece depois de existir um agente autorizado e uma fonte de dados verificável.",
    dbError: "A base de dados ainda não está ligada — segue os passos de configuração no dashboard.",
    retry: "Não foi possível enviar — tenta novamente.",
  },
  pay: {
    title: "Pagamentos internacionais (USD / EUR)",
    intro: "O checkout Stripe é o canal de cobrança automática quando o produto estiver publicado e configurado. Transferências bancárias continuam sujeitas a confirmação humana e comprovativo verificável.",
    account: "Número de conta",
    routing: "Routing (ABA)",
    iban: "IBAN",
    bic: "BIC / SWIFT",
    beneficiary: "Beneficiário",
    benefAddr: "Morada do beneficiário",
    copy: "Copiar",
    detailedNote: "Pagamentos locais e transferências internacionais ficam indisponíveis até existir um provedor real configurado. Qualquer confirmação deve ser feita manualmente com comprovativo verificável.",
    checking: "Conta à ordem (Corrente)",
  },
  dash: {
    title: "Centro de Comando",
    sub: "Dados ao vivo · execuções dos agentes auditáveis · outreach exige consentimento",
    refresh: "Atualizar",
    live: "Ao vivo",
    connecting: "A ligar…",
    offline: "Offline",
    liveTip: "Realtime ligado — as atualizações chegam instantaneamente",
    connectingTip: "A ligar ao realtime…",
    offlineTip: "Realtime desligado — a mostrar os últimos dados; vai religar automaticamente",
    menu: "Módulos",
    modules: {
      overview: ["Visão geral", "Pulso de hoje e ativação"],
      packs: ["Pacotes de produto", "Estúdio baseado em evidências"],
      leads: ["Leads", "Pipeline e qualificação IA"],
      charts: ["Análises", "Receita, funil e rendimento"],
      clients: ["Clientes", "Planos, MRR e estado"],
      orders: ["Pedidos", "Vendas e cobranças"],
      agents: ["Agentes IA", "Memória aprendida e execuções"],
      ecosystem: ["Ecossistema", "O loop autónomo ao vivo"],
    },
    today: { leads: "Leads hoje", sales: "Vendas hoje", collected: "Cobrado hoje", runs: "Execuções de agentes hoje" },
    onb: {
      title: "Ativa o teu ecossistema",
      sub: "O sistema começa vazio e cresce com atividade real. Cada passo desbloqueia quando a base de dados o prova.",
      leads: ["Captura o teu primeiro lead", "Partilha o formulário público de leads — cada submissão chega aqui em tempo real."],
      clients: ["Regista o teu primeiro cliente", "Adiciona um cliente real no módulo Clientes (Starter 1.250 Kz, Professional 2.916 Kz, Enterprise 8.333 Kz por mês)."],
      orders: ["Regista a tua primeira venda", "Cria um pedido real no módulo Pedidos apenas depois de o provedor de pagamento e a disponibilidade do produto serem verificados."],
      collect: ["Cobra o teu primeiro pagamento", "Marca um pedido como pago quando o dinheiro chegar — os gráficos de receita e as tabelas de rendimento atualizam de imediato."],
      agents: ["Os agentes completam o primeiro ciclo", "Os bots autónomos correm no GitHub Actions (diário 06:00 UTC + de hora a hora). As primeiras execuções reais aparecem aqui e no módulo Agentes IA."],
    },
    cards: {
      leads: "Leads capturados",
      qualified: "Leads qualificados",
      clients: "Clientes ativos",
      mrr: "MRR",
      revenue: "Receita 30 dias",
      win: "Taxa de fecho",
    },
    chart14: "Leads — últimos 14 dias (captações reais)",
    activity: {
      title: "Atividade ao vivo",
      sub: "Apenas atividade real do Supabase",
      verified: "Dados verificados",
      empty: "Os agentes autónomos reportam aqui assim que executam — pontuação de leads, insights diários e triagem de incidentes, diretamente do registo de atividade real.",
    },
    orders: {
      latest: "Pedidos recentes",
      empty: "As vendas aparecem aqui no momento em que pedidos reais são registados — com referência de pagamento, método e estado de cobrança.",
      form: "Pedido",
      client: "Cliente",
      walkin: "— Cliente avulso —",
      amount: "Valor (AOA)",
      method: "Método",
      create: "Criar pedido (gera referência de pagamento)",
      thRef: "Referência",
      thClient: "Cliente",
      thAmount: "Valor",
      thMethod: "Método",
      thStatus: "Estado",
      thAction: "Ação",
      markPaid: "Marcar como pago",
      methods: { multicaixa: "Multicaixa Express", paypay: "PayPay", card: "Cartão", wire_usd: "Transferência internacional — USD (Lead Bank)", wire_eur: "Transferência internacional — EUR (Banking Circle)" },
    },
    leadsTab: {
      company: "Empresa",
      contact: "Contacto",
      channel: "Canal",
      score: "Pontuação",
      nextAction: "Próxima ação",
      status: "Estado",
      empty: "Ainda sem leads — cada submissão real do formulário público chega aqui instantaneamente, pontuada e priorizada pelos agentes.",
      aiTag: "IA",
    },
    statusLead: { new: "novo", contacted: "contactado", qualified: "qualificado", won: "ganho", lost: "perdido" },
    statusOrder: { pending: "pendente", paid: "pago", refunded: "reembolsado" },
    statusClient: { active: "ativo", trialing: "em teste", churned: "cancelado" },
    actions: { hot: "Enviar proposta em 24h", warm: "Agendar demonstração esta semana", cold: "Nutrir via sequência de email" },
    charts: {
      volume: "Volume de vendas — últimos 14 dias",
      collected: "Cobrado:",
      awaiting: "À espera:",
      funnel: "Funil de marketing e vendas (leads reais)",
      funnelStages: { captured: "Captado", contacted: "Contactado", qualified: "Qualificado", won: "Ganho" },
      mrr: "Receita recorrente por plano (clientes ativos)",
      mrrEmpty: "Ainda sem clientes ativos — a divisão por plano aparece assim que existirem subscrições reais.",
      leadsLegend: "Leads",
      collectedLegend: "Cobrado",
      awaitingLegend: "Aguarda pagamento",
    },
    income: {
      byMethod: "Rendimento por método de pagamento",
      byClient: "Rendimento por cliente",
      source: "Origem",
      paid: "Cobrado (pago)",
      pending: "A receber (pendente)",
      orders: "Pedidos",
      share: "Peso no rendimento",
      empty: "Ainda sem pedidos — o rendimento aparece aqui no momento em que vendas reais são registadas.",
    },
    clientsTab: {
      new: "Novo cliente",
      name: "Nome da empresa",
      email: "Email de faturação",
      plan: "Plano",
      create: "Criar cliente",
      empty: "Ainda sem clientes — cria o primeiro acima e os cartões de plano, o gráfico de MRR e as tabelas de rendimento ganham vida com subscrições reais.",
      perMonth: "/mês",
    },
    agents: {
      protocol: "Protocolo de autonomia",
      ready: "Os agentes estão prontos para aprender e agir",
      body: "Agentes agendados processam leads, resultados, incidentes e sinais de produto reais. Adaptam a pontuação a partir de vitórias e perdas registadas, enquanto o outreach a clientes fica limitado a canais com consentimento.",
      observe: "Observar",
      observeDesc: "Lê sinais reais e estado de consentimento",
      learn: "Aprender",
      learnDesc: "Guarda evidência de resultados ganhos/perdidos",
      act: "Agir",
      actDesc: "Qualifica, redige e regista as próximas ações",
      safety: "Limite de segurança: nenhuma mensagem não solicitada, compra ou publicação. Aprovação humana obrigatória para ações fora dos canais ligados e consentidos.",
      promptTitle: "Runtime de prompts",
      promptBody: "Instruções estáveis e contratos de ferramentas estão separados dos registos por execução. O contexto dinâmico é renovado à hora e contém apenas dados verificados da conta.",
      tools: "Ferramentas:",
      cacheKey: "Chave de cache:",
      bytes: "Bytes de contexto:",
      runs: "Execuções registadas",
      lastRun: "Última execução",
      waiting: "à espera",
      idle: "inativo",
      active: "ativo",
      activeCount: "ativo(s)",
      scheduled: "Agendado",
      learned: "Aprendido:",
      noRuns: "Ainda sem execuções registadas — à espera do trabalho agendado do GitHub Actions",
      foot: "As execuções são contadas a partir de entradas reais do activity_log; os cartões “Aprendido” mostram a memória viva dos agentes escrita pelos bots a partir de negócios reais ganhos/perdidos e correções de incidentes. Arranque a frio = sem resultados decididos, por isso os agentes usam priores neutros e adaptam-se quando as vendas acontecem.",
      scheduleLead: "diário 06:00 UTC",
      scheduleInsight: "diário 06:00 UTC",
      scheduleError: "de hora a hora",
      scheduleMarketing: "diário 06:00 UTC",
    },
    eco: {
      title: "Como funciona o ecossistema — ao vivo",
      sub: "Um loop contínuo: cada etapa lê e escreve na mesma base de dados real. Nenhum passo é simulado.",
      capture: ["Captar", "O formulário público de leads e os canais de marketing empurram cada prospecto para a tabela leads — visível instantaneamente via realtime."],
      qualify: ["Qualificar", "O bot Qualificador de Leads pontua cada novo lead de 0-100 usando IA mais o seu viés de conversão por canal aprendido, e escreve a próxima melhor ação."],
      convert: ["Converter", "Leads quentes tornam-se clientes (planos Starter / Professional / Enterprise), registados aqui com a sua receita recorrente mensal."],
      collect: ["Cobrar", "Cada venda cria um pedido com referência de pagamento. Marcar como pago move o dinheiro para os gráficos de receita e tabelas de rendimento."],
      learn: ["Aprender", "Os bots persistem o que aprendem (que canais convertem, que correções funcionaram) em agent_memory — cada decisão futura usa isso."],
      loopNote: "O loop fecha: Aprender alimenta Qualificar — cada execução pontua novos leads com tudo o que foi aprendido até agora.",
      realtime: "Supabase realtime",
      realtimeBody: "Cada lead, venda, pagamento e execução de bot é empurrado para esta página no momento em que acontece — sem refresh.",
      agentsCard: "Agentes autónomos",
      awaitingFirst: "à espera da primeira execução",
      cc: "Este centro de comando",
      ccBody: "App estática (Vite + React) a ler o teu projeto Supabase real. Publicada automaticamente a cada push — os mesmos dados em todos os dispositivos.",
      channels: "Canais globais de crescimento",
      channelsSub: "A descoberta orgânica está pronta a planear; envio e publicação ficam desativados até cada conta ser autorizada.",
      consent: "Consentimento primeiro",
      chSeo: "Website + SEO",
      chSeoDesc: "Lead magnets, landing pages e metadados de pesquisa",
      chEmail: "Email",
      chEmailDesc: "Contactos com opt-in e tratamento de cancelamento",
      chShopify: "Shopify",
      chShopifyDesc: "Pacotes digitais aprovados e listagens de loja",
      chSocial: "Marketplaces sociais",
      chSocialDesc: "Apenas conteúdo orgânico aprovado pela plataforma",
      statusPlanning: "Em planeamento",
      statusNotConnected: "Não ligado",
      learned: "O que os agentes já aprenderam",
      learnedEmpty: "Nada aprendido ainda — é o esperado num arranque a frio. As primeiras execuções dos bots e negócios decididos vão popular este painel com conhecimento real e merecido.",
      runsShort: "execuções ·",
      updated: "atualizado",
      memoryEntries: "entradas de memória ·",
      runsToday: "execuções hoje",
      qualifiedShort: "qualificados",
      activeClients: "clientes ativos ·",
      collected30: "cobrado (30d)",
    },
    packs: {
      badge: "Estúdio de produto autónomo",
      title: "Criar a partir de evidências, não de suposições",
      sub: "Este estúdio organiza registos reais da conta num pacote de produto profissional. Nunca rotula dados em falta como procura e nunca publica sem autorização.",
      niche: "Nicho do produto",
      audience: "Público-alvo",
      problem: "Problema do cliente",
      audiencePh: "Para quem é isto?",
      problemPh: "Que problema real?",
      advance: "Avançar etapa",
      reset: "Reiniciar espaço de trabalho",
      stages: [
        ["Brief", "Define o comprador e o problema."],
        ["Evidências", "Verifica sinais e proveniência."],
        ["Montagem", "Escreve os artefactos internos do produto."],
        ["Revisão", "Confirma alegações, ajuste e bloqueios."],
        ["Pronto", "Pronto internamente; canais externos continuam bloqueados."],
      ],
      evTitle: "Evidências verificadas",
      evSub: "Apenas registos carregados são contados; o tempo de verificação é mostrado para rastreabilidade.",
      records: "registos",
      recordsShort: "registos ·",
      risks: "Cancelas de prontidão",
      deliv: "Entregáveis internos",
      delivItems: ["Promessa do produto", "Esboço da oferta", "Metadados SEO", "Rascunho de lead magnet"],
      delivNote: "Disponível depois de as cancelas de evidências e revisão passarem.",
      delivFoot: "Publicação, Shopify, email e ações sociais ficam desativadas até as integrações oficiais serem autorizadas.",
      sources: { leads: "leads", clients: "clientes", orders: "pedidos", activity: "atividade", agent_memory: "memória de agentes" },
      risksDict: {
        "no-evidence": ["Evidências insuficientes", "Liga ou carrega registos reais antes de alegar procura de mercado."],
        market: ["Mercado-alvo incompleto", "Define público e problema do cliente antes da montagem."],
        stale: ["Evidências desatualizadas", "Alguns registos têm mais de 30 dias e precisam de revisão."],
        channels: ["Canais externos bloqueados", "Email, Shopify e publicação social exigem autorização."],
      },
    },
    common: { none: "—" },
  },
} as const;

/**
 * Versão "widened" do dicionário PT: converte literais em string/number
 * recursivamente para que o EN possa diferir nos valores sem quebrar tipos.
 */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends readonly unknown[]
      ? { [K in keyof T]: Widen<T[K]> } extends infer M ? { [K in keyof M]: M[K] } : never
      : T extends object
        ? { [K in keyof T]: Widen<T[K]> }
        : T;

export type Dict = Widen<typeof pt>;

const en: Dict = {
  nav: {
    home: "Home",
    products: "Products",
    store: "Store",
    agents: "AI Agents",
    services: "Services",
    support: "Support",
    dashboard: "Dashboard",
    signOut: "Sign out",
    getStarted: "Get started",
    openCC: "Open your command center",
    cc: "Command center",
    toggleMenu: "Toggle menu",
  },
  lang: {
    label: "Language",
    pt: "Português",
    en: "English",
    switch: "Switch to Portuguese",
  },
  agents: {
    names: {
      lead_qualifier: "Lead Qualifier",
      insight_engine: "Insight Engine",
      error_handler: "Error Handler",
      growth_marketing: "Growth & Marketing Agent",
      ai_teacher: "AI Teacher",
      ai_manager: "AI Manager",
      skills_scout: "Skills Scout",
    },
  },
  ops: {
    menu: "Operations",
    sub: "The AI Manager commands the team: daily missions, automatic pack sales, quality assurance, and fresh skills from the skills.sh ecosystem.",
    managerCard: "AI Manager",
    managerRole: "Operations director · commands the AI team with no administrative approval",
    schedule: "Daily 05:30 UTC · GitHub Actions",
    missionsTitle: "Missions of the day",
    missionsSub: "Assigned automatically to each agent from real data",
    objective: "Objective",
    directive: "Directive",
    bottleneck: "Bottleneck",
    assignedBy: "Assigned by the AI Manager",
    noMissions: "No missions yet — the AI Manager runs every day at 05:30 UTC",
    qaTitle: "Delivery quality assurance",
    qaSub: "Every sold pack is auto-registered and verified by the Error Handler",
    qaPending: "Awaiting verification",
    qaPassed: "Passed",
    qaFailed: "Failed",
    qaClient: "Client",
    qaPack: "Pack",
    qaChecks: "Checks",
    qaVerified: "Verified",
    qaAwaiting: "Waiting for the first QA cycle",
    checksLabels: {
      order_paid: "Order paid",
      client_registered: "Client registered",
      amount_matches_pack: "Amount matches pack",
      product_operational: "Product operational",
    },
    skillsTitle: "Ecosystem skills (skills.sh)",
    skillsSub: "The Skills Scout searches the commands and prompts each agent needs and delivers them to the agent's memory",
    skillsAgent: "Agent",
    skillsFound: "Skills found",
    skillsRecommended: "Recommended",
    skillsInstructions: "Instructions fetched",
    skillsNone: "No new skills — the Scout runs daily at 05:30 UTC",
    ecosystem: "Ecosystem",
    howTitle: "Autonomous operations cycle",
    step1: "05:30 — The AI Manager reads real data and assigns missions to each agent.",
    step2: "05:30 — The Skills Scout searches skills.sh for the techniques the team needs.",
    step3: "06:00 — The agents execute their missions: qualification, campaigns, insights.",
    step4: "Hourly — QA: every sold pack is verified as functional for the client.",
  },
  academy: {
    tabAgents: "Agents",
    tabAcademy: "AI Academy",
    sub: "The AI Teacher studies the real market and trains the other agents on its own — no administrative approval needed.",
    teacherCard: "AI Teacher",
    teacherRole: "Faculty · studies real market data and writes the lessons",
    schedule: "Daily 06:00 UTC · GitHub Actions",
    runs: "Classes taught",
    briefs: "Lessons written",
    lastClass: "Last class",
    noClass: "No classes yet — waiting for the first scheduled cycle",
    autonomy: "100% autonomous: reads real data and refreshes the lessons on its own",
    autonomyBadge: "Autonomous",
    studentsTitle: "Students",
    studentsSub: "Each agent follows its own sales-skill curriculum",
    graduation: {
      enrolled: "Enrolled",
      in_training: "In training",
      trained: "Trained",
    },
    briefTitle: "Current market brief",
    noBrief: "No brief yet — the AI Teacher writes one every cycle",
    freshness: { fresh: "Fresh", aging: "Aging", stale: "Outdated" },
    skills: "Skills",
    lessons: "Lessons in memory",
    marketState: "Market state",
    instruction: "Instruction",
    focusSkills: "Focus",
    avoid: "Avoid",
    briefDate: "Lesson of",
    howTitle: "How the Academy works",
    step1: "The AI Teacher reads the real funnel data (leads, clients, revenue) — nothing simulated.",
    step2: "It diagnoses each agent's knowledge gaps and what has gone stale.",
    step3: "It writes an individual market brief into each agent's memory.",
    step4: "On the next scheduled run, each agent applies the lesson while selling — on its own.",
  },
  hero: {
    sticker: "Human + AI command system · real data only",
    kicker: "FONTES / AI ADMIN ADJUNTA",
    title1: "Your business, running",
    titleAccent: "itself",
    sub: "Fontes AI Admin Adjunta turns approved research into product packs, qualifies buyer opportunities and keeps every action auditable — with consent-gated outreach and real data when connected.",
    ctaPrimary: "Get started free",
    ctaSecondary: "See live dashboard",
    noticeTitle: "Real business data only",
    noticeBody: "Metrics, prices, availability and results only appear once they exist in the connected data source. No demo numbers.",
  },
  features: {
    title: "An ecosystem, not a dashboard",
    sub: "Six systems working together so your admin work happens while you sleep.",
    leads: { title: "Lead Hunter Swarm", desc: "Research agents only surface leads when an authorized source is connected and every record is verifiable." },
    sales: { title: "Sales Automaton", desc: "Signal analysis and pitch drafting stay unavailable until real data and an authorized source exist." },
    clients: { title: "Client Command Center", desc: "Every client, plan, MRR and churn risk in one view. The engine recommends the next best action per account." },
    data: { title: "Live Business Data", desc: "Real leads, real orders, real revenue — stored in Supabase Postgres with row-level security. No spreadsheets." },
    payments: { title: "Payments with Guarantees", desc: "Orders and payments only appear after a real provider is configured and verified confirmation exists; no automatic charging in this version." },
    security: { title: "Bank-grade Security", desc: "Row-level security on every table, TLS 1.3 in transit, AES-256 at rest. Your business data stays yours." },
  },
  eco: {
    market: "Market",
    marketDesc: "Signals and prices only from connected sources",
    agents: "AI Agents",
    agentsDesc: "Research, sales and product with auditability",
    projects: "Projects",
    projectsDesc: "Human operation with administrative control",
  },
  lab: {
    badge: "Visual lab",
    title: "Six identities. One living ecosystem.",
    sub: "Pick a direction per surface. The current implementation combines Neon Anime Punk on the website with Cyber Market Command in the app.",
    active: "Active direction: hybrid",
    items: [
      ["Fontes Pulse", "Geometric F, energy lines and cyan/magenta pulse.", "Website accent"],
      ["AI Human Core", "Human face and circuitry for trust and closeness.", "Trust layer"],
      ["Neon Orbit", "Luminous orbit for AI, agents and connected data.", "Motion system"],
      ["Anime Visor", "Futuristic emblem, scanlines and subtle glitch.", "Campaign mode"],
      ["Command Mark", "Modular monogram with real operation states.", "Admin active"],
      ["Dual Identity", "Artistic Fontes; technical, operational AI Admin Adjunta.", "Selected hybrid"],
    ],
    tags: "Neon Anime Punk website · Cyber Market Command dashboard · Human-Tech checkout · prefers-reduced-motion · real data only",
  },
  how: {
    badge: "How it works",
    title: "From stranger to signed contract — on autopilot",
    steps: [
      ["Hunt", "Bots scan your niches daily and capture leads with company, contact and score."],
      ["Qualify", "The engine scores every lead and routes hot ones straight to your pipeline."],
      ["Close", "Sales automaton drafts the pitch and tracks the order from reference to payment."],
      ["Keep", "Command center monitors MRR, churn risk and next best actions per client."],
    ],
    previewLabel: "Workflow preview",
    previewTitle: "Live activity unavailable",
    previewBody: "Activity, sales and leads will appear here only once they exist in the connected database.",
    liveTag: "live data unavailable",
  },
  pricing: {
    title: "Pricing",
    sub: "Connect your database and start winning. The bots are already waiting to work for you.",
    popular: "Most popular",
    users: { starter: "10 users", professional: "50 users", enterprise: "Unlimited users" },
    period: "/month",
    starter: {
      features: ["Lead hunter (daily)", "Sales dashboard", "Email support", "1 automation flow"],
      cta: "Start with Starter",
    },
    professional: {
      features: ["Lead hunter swarm (24/7)", "Sales automaton + pitches", "Client command center", "Priority WhatsApp support", "Unlimited automation flows"],
      cta: "Go Professional",
    },
    enterprise: {
      features: ["Everything in Professional", "Custom AI agents for your niche", "Dedicated success manager", "SLA 99.98% + audit logs"],
      cta: "Talk to sales",
    },
  },
  cta: {
    title: "Let the bots work while you sleep",
    body: "Real purchases and payments require a configured provider and verifiable confirmation. No demo data.",
    button: "Request your demo",
  },
  auth: {
    welcome: "Welcome back",
    create: "Create your account",
    signinSub: "Sign in to your AI admin command center.",
    signupSub: "Start automating your sales in minutes.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signUp: "Create account",
    wait: "Please wait…",
    noAccount: "No account yet?",
    signupLink: "Sign up",
    hasAccount: "Already registered?",
    signinLink: "Sign in",
    back: "← Back to home",
    dbNotice: "Real accounts require the database connection. Follow the setup steps on the dashboard.",
    errEmail: "Enter a valid email address.",
    errPassword: "Password must be at least 8 characters.",
    errDb: "Accounts are disabled until the database is connected (see dashboard setup steps).",
    errGeneric: "Something went wrong",
  },
  footer: {
    tag: "The autonomous AI admin that hunts leads, closes sales and runs your business operations 24/7.",
    contact: "Contact",
    payments: "Payments: Multicaixa Express · PayPay ·",
    paymentsLink: "USD/EUR accounts",
    company: "Company",
    rights: "© 2026 · All rights reserved",
    terms: "Commercial terms published when available",
  },
  setup: {
    title: "Database connection required",
    sub: "This app runs on real data only — no demo mode, no simulations.",
    alert: "The live Supabase workspace is not connected in this deployment, so authenticated data, persistence and autonomous delivery are paused. No fake leads, buyers or outreach are shown.",
    hint: "You can review the product-pack workflow from the public preview. Connect Supabase and run the repository migrations when you are ready to enable real storage, agent runs and consent-gated outreach.",
  },
  leadForm: {
    title: "See your business on autopilot",
    sub: "Tell us about your company — we'll come back with a personalized automation plan.",
    company: "Company",
    name: "Your name",
    email: "Work email",
    niche: "Your niche",
    nicheSaaS: "SaaS / Technology",
    nicheFintech: "Fintech / Finance",
    nicheHealth: "Healthcare",
    nicheEcom: "E-commerce / Retail",
    nicheLogistics: "Logistics",
    nicheAgencies: "Agencies / Services",
    send: "Request free automation audit",
    sending: "Sending…",
    doneTitle: "Request received!",
    doneBody: "Your request is now a real lead in our system. Qualification will only happen after an authorized agent and a verifiable data source are available.",
    dbError: "The database is not connected yet — follow the setup steps on the dashboard.",
    retry: "Could not submit — please try again.",
  },
  pay: {
    title: "International payments (USD / EUR)",
    intro: "Stripe checkout is the automatic charging channel once the product is published and configured. Bank transfers remain subject to human confirmation and verifiable proof.",
    account: "Account number",
    routing: "Routing (ABA)",
    iban: "IBAN",
    bic: "BIC / SWIFT",
    beneficiary: "Beneficiary",
    benefAddr: "Beneficiary address",
    copy: "Copy",
    detailedNote: "Local and international payments remain unavailable until a real provider is configured. Any confirmation must be done manually with verifiable proof.",
    checking: "Checking account",
  },
  dash: {
    title: "Command Center",
    sub: "Live data · agent runs are auditable · outreach requires consent",
    refresh: "Refresh",
    live: "Live",
    connecting: "Connecting…",
    offline: "Offline",
    liveTip: "Realtime connected — updates arrive instantly",
    connectingTip: "Connecting to realtime…",
    offlineTip: "Realtime disconnected — showing last data; will rejoin automatically",
    menu: "Modules",
    modules: {
      overview: ["Overview", "Today's pulse and activation"],
      packs: ["Product packs", "Evidence-driven studio"],
      leads: ["Leads", "Pipeline and AI qualification"],
      charts: ["Analytics", "Revenue, funnel and income"],
      clients: ["Clients", "Plans, MRR and status"],
      orders: ["Orders", "Sales and collections"],
      agents: ["AI Agents", "Learned memory and runs"],
      ecosystem: ["Ecosystem", "The autonomous loop, live"],
    },
    today: { leads: "Leads today", sales: "Sales today", collected: "Collected today", runs: "Agent runs today" },
    onb: {
      title: "Activate your ecosystem",
      sub: "The system starts empty and grows with real activity. Each step unlocks as the database proves it.",
      leads: ["Capture your first lead", "Share the public lead form — every submission lands here in real time."],
      clients: ["Register your first client", "Add a real client in the Clients module (Starter 1,250 Kz, Professional 2,916 Kz, Enterprise 8,333 Kz per month)."],
      orders: ["Record your first sale", "Create a real order in the Orders module only after the payment provider and product availability have been verified."],
      collect: ["Collect your first payment", "Mark an order as paid once the money arrives — revenue charts and income tables update instantly."],
      agents: ["Agents complete their first cycle", "The autonomous bots run on GitHub Actions (daily 06:00 UTC + hourly). Their first real runs appear here and in the AI Agents module."],
    },
    cards: {
      leads: "Leads captured",
      qualified: "Qualified leads",
      clients: "Active clients",
      mrr: "MRR",
      revenue: "Revenue 30d",
      win: "Win rate",
    },
    chart14: "Leads — last 14 days (real captures)",
    activity: {
      title: "Live activity",
      sub: "Real Supabase activity only",
      verified: "Verified data",
      empty: "The autonomous agents report here the moment they run — lead scoring, daily insights and incident triage, straight from the real activity log.",
    },
    orders: {
      latest: "Latest orders",
      empty: "Sales appear here the moment real orders are recorded — with payment reference, method and collection status.",
      form: "Order",
      client: "Client",
      walkin: "— Walk-in —",
      amount: "Amount (AOA)",
      method: "Method",
      create: "Create order (generates payment reference)",
      thRef: "Reference",
      thClient: "Client",
      thAmount: "Amount",
      thMethod: "Method",
      thStatus: "Status",
      thAction: "Action",
      markPaid: "Mark paid",
      methods: { multicaixa: "Multicaixa Express", paypay: "PayPay", card: "Card", wire_usd: "International wire — USD (Lead Bank)", wire_eur: "International transfer — EUR (Banking Circle)" },
    },
    leadsTab: {
      company: "Company",
      contact: "Contact",
      channel: "Channel",
      score: "Score",
      nextAction: "Next action",
      status: "Status",
      empty: "No leads yet — every real submission from the public lead form lands here instantly, scored and prioritized by the agents.",
      aiTag: "AI",
    },
    statusLead: { new: "new", contacted: "contacted", qualified: "qualified", won: "won", lost: "lost" },
    statusOrder: { pending: "pending", paid: "paid", refunded: "refunded" },
    statusClient: { active: "active", trialing: "trialing", churned: "churned" },
    actions: { hot: "Send proposal within 24h", warm: "Schedule demo this week", cold: "Nurture via email sequence" },
    charts: {
      volume: "Sales volume — last 14 days",
      collected: "Collected:",
      awaiting: "Awaiting:",
      funnel: "Marketing & sales funnel (real leads)",
      funnelStages: { captured: "Captured", contacted: "Contacted", qualified: "Qualified", won: "Won" },
      mrr: "Recurring revenue by plan (active clients)",
      mrrEmpty: "No active clients yet — the split by plan appears as soon as real subscriptions exist.",
      leadsLegend: "Leads",
      collectedLegend: "Collected",
      awaitingLegend: "Awaiting payment",
    },
    income: {
      byMethod: "Income by payment method",
      byClient: "Income by client",
      source: "Source",
      paid: "Collected (paid)",
      pending: "Awaiting (pending)",
      orders: "Orders",
      share: "Share of income",
      empty: "No orders yet — income appears here the moment real sales are recorded.",
    },
    clientsTab: {
      new: "New client",
      name: "Company name",
      email: "Billing email",
      plan: "Plan",
      create: "Create client",
      empty: "No clients yet — create the first one above and the plan cards, MRR pie and income tables come alive with real subscriptions.",
      perMonth: "/mo",
    },
    agents: {
      protocol: "Autonomy protocol",
      ready: "Agents are ready to learn and act",
      body: "Scheduled agents process real leads, outcomes, incidents and product signals. They adapt scoring from recorded wins and losses, while client-facing outreach stays limited to opted-in channels.",
      observe: "Observe",
      observeDesc: "Reads real signals and consent state",
      learn: "Learn",
      learnDesc: "Stores evidence from won/lost outcomes",
      act: "Act",
      actDesc: "Qualifies, drafts and logs next actions",
      safety: "Safety boundary: no unsolicited messages, purchases or public posts. Human approval is required for actions outside connected, consented channels.",
      promptTitle: "Prompt runtime",
      promptBody: "Stable instructions and tool contracts are separated from per-run records. Dynamic context is refreshed by hour and contains only verified account data.",
      tools: "Tools:",
      cacheKey: "Cache key:",
      bytes: "Context bytes:",
      runs: "Recorded runs",
      lastRun: "Last run",
      waiting: "waiting",
      idle: "idle",
      active: "active",
      activeCount: "active",
      scheduled: "Scheduled",
      learned: "Learned:",
      noRuns: "No runs recorded yet — waiting for the scheduled GitHub Actions job",
      foot: "Runs are counted from real activity_log entries; “Learned” cards show live agent memory written by the bots from real won/lost deals and incident fixes. Cold start = no decided outcomes yet, so agents use neutral priors and adapt as real sales happen.",
      scheduleLead: "daily 06:00 UTC",
      scheduleInsight: "daily 06:00 UTC",
      scheduleError: "hourly",
      scheduleMarketing: "daily 06:00 UTC",
    },
    eco: {
      title: "How the ecosystem works — live",
      sub: "One continuous loop: every stage reads and writes the same real database. No step is simulated.",
      capture: ["Capture", "The public lead form and marketing channels push every prospect into the leads table — instantly visible via realtime."],
      qualify: ["Qualify", "The Lead Qualifier bot scores every new lead 0-100 using AI plus its own learned channel-conversion bias, and writes the next best action."],
      convert: ["Convert", "Hot leads become clients (Starter / Professional / Enterprise plans), registered here with their monthly recurring revenue."],
      collect: ["Collect", "Every sale creates an order with a payment reference. Marking it paid moves the money into revenue charts and income tables."],
      learn: ["Learn", "Bots persist what they learn (which channels convert, which fixes worked) into agent_memory — every future decision uses it."],
      loopNote: "The loop closes: Learn feeds back into Qualify — each agent run scores new leads with everything learned so far.",
      realtime: "Supabase realtime",
      realtimeBody: "Every lead, sale, payment and bot run is pushed to this page the moment it happens — no refresh needed.",
      agentsCard: "Autonomous agents",
      awaitingFirst: "awaiting first run",
      cc: "This command center",
      ccBody: "Static app (Vite + React) reading your real Supabase project. Deployed automatically on every push — same data on every device.",
      channels: "Global growth channels",
      channelsSub: "Organic discovery is ready to plan; sending and publishing stay disabled until each account is authorized.",
      consent: "Consent-first",
      chSeo: "Website + SEO",
      chSeoDesc: "Lead magnets, landing pages and search metadata",
      chEmail: "Email",
      chEmailDesc: "Opted-in contacts with unsubscribe handling",
      chShopify: "Shopify",
      chShopifyDesc: "Approved digital packs and storefront listings",
      chSocial: "Social marketplaces",
      chSocialDesc: "Platform-approved organic content only",
      statusPlanning: "Planning",
      statusNotConnected: "Not connected",
      learned: "What the agents have learned",
      learnedEmpty: "Nothing learned yet — this is expected on a cold start. The first bot runs and decided deals will populate this panel with real, earned knowledge.",
      runsShort: "runs ·",
      updated: "updated",
      memoryEntries: "memory entries ·",
      runsToday: "runs today",
      qualifiedShort: "qualified",
      activeClients: "active clients ·",
      collected30: "collected (30d)",
    },
    packs: {
      badge: "Autonomous product studio",
      title: "Create from evidence, not assumptions",
      sub: "This studio organizes real account records into a professional product pack. It never labels missing data as demand and never publishes without authorization.",
      niche: "Product niche",
      audience: "Target audience",
      problem: "Customer problem",
      audiencePh: "Who is this for?",
      problemPh: "What real problem?",
      advance: "Advance stage",
      reset: "Reset workspace",
      stages: [
        ["Brief", "Define the buyer and problem."],
        ["Evidence", "Verify signals and provenance."],
        ["Assembly", "Write the internal product artifacts."],
        ["Review", "Check claims, fit and blockers."],
        ["Ready", "Ready internally; external channels remain gated."],
      ],
      evTitle: "Verified evidence",
      evSub: "Only loaded records are counted; verification time is shown for traceability.",
      records: "records",
      recordsShort: "records ·",
      risks: "Readiness gates",
      deliv: "Internal deliverables",
      delivItems: ["Product promise", "Offer outline", "SEO metadata", "Lead magnet draft"],
      delivNote: "Available after evidence and review gates pass.",
      delivFoot: "Publishing, Shopify, email and social actions are disabled until their official integrations are authorized.",
      sources: { leads: "leads", clients: "clients", orders: "orders", activity: "activity", agent_memory: "agent memory" },
      risksDict: {
        "no-evidence": ["Insufficient evidence", "Connect or load real records before claiming market demand."],
        market: ["Target market incomplete", "Define audience and customer problem before assembly."],
        stale: ["Stale evidence", "Some records are older than 30 days and need review."],
        channels: ["External channels gated", "Email, Shopify and social publishing require authorization."],
      },
    },
    common: { none: "—" },
  },
};

const dict: Record<Lang, Dict> = { pt, en };

/** Resolve um caminho "a.b.c" no dicionário; devolve undefined se não existir. */
export function lookup(lang: Lang, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict[lang]);
}

/**
 * Hook de tradução: `const t = useT(); t("dash.title")`.
 * Faz fallback para PT se uma chave faltar no idioma ativo.
 */
export function useT() {
  const lang = useLang();
  return (path: string): string => {
    const value = lookup(lang, path) ?? lookup("pt", path);
    return typeof value === "string" ? value : path;
  };
}

/** Lista de strings (arrays no dicionário) com fallback para PT. */
export function useTList() {
  const lang = useLang();
  return (path: string): string[] => {
    const value = lookup(lang, path) ?? lookup("pt", path);
    return Array.isArray(value) ? (value as string[]) : [];
  };
}

/** Objeto aninhado do dicionário (ex.: tObj("dash.modules.leads") => [label, desc]). */
export function useTAny() {
  const lang = useLang();
  return (path: string): unknown => lookup(lang, path) ?? lookup("pt", path);
}
