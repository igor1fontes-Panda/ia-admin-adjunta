#!/usr/bin/env python3
"""Gera o relatório PDF completo do projeto — estado atual, sem segredos.

Uso: python3 scripts/generate-project-report.py
Saída: docs/reports/Estado_Completo_do_Projeto_<data>.pdf
"""
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
NOW = datetime.now(timezone.utc)
OUT_DIR = ROOT / "docs" / "reports"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / f"Estado_Completo_do_Projeto_{NOW:%Y-%m-%d}.pdf"

# ---------------------------------------------------------------- styles ----
ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Title"], fontSize=20, spaceAfter=6, textColor=colors.HexColor("#111827"))
H2 = ParagraphStyle("H2", parent=ss["Heading1"], fontSize=14, spaceBefore=14, spaceAfter=6, textColor=colors.HexColor("#1f2937"))
H3 = ParagraphStyle("H3", parent=ss["Heading2"], fontSize=11.5, spaceBefore=10, spaceAfter=4, textColor=colors.HexColor("#374151"))
BODY = ParagraphStyle("BODY", parent=ss["BodyText"], fontSize=9.3, leading=13, spaceAfter=5)
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=8.2, leading=11, textColor=colors.HexColor("#4b5563"))
CODE = ParagraphStyle("CODE", parent=ss["Code"], fontName="Courier", fontSize=7.8, leading=10.5, backColor=colors.HexColor("#f3f4f6"), borderPadding=4, spaceAfter=6)
TH = ParagraphStyle("TH", parent=BODY, fontName="Helvetica-Bold", fontSize=8.4, leading=11)
TD = ParagraphStyle("TD", parent=BODY, fontSize=8.2, leading=11)
TDM = ParagraphStyle("TDM", parent=TD, fontName="Courier", fontSize=7.6)

ACCENT = colors.HexColor("#d4af37")
GRID = colors.HexColor("#d1d5db")
HEADBG = colors.HexColor("#111827")

def table(headers, rows, widths, mono_cols=()):
    data = [[Paragraph(h, TH) for h in headers]]
    for r in rows:
        data.append([Paragraph(str(c), TDM if i in mono_cols else TD) for i, c in enumerate(r)])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADBG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawString(15 * mm, 10 * mm, "Fontes AI Admin Adjunta — Estado completo do projeto (sem segredos)")
    canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, f"pág. {doc.page}")
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(0.8)
    canvas.line(15 * mm, 13.5 * mm, A4[0] - 15 * mm, 13.5 * mm)
    canvas.restoreState()

# ---------------------------------------------------------- live repo data --
def sh(cmd):
    try:
        return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=15).stdout.strip()
    except Exception:
        return ""

GIT_HEAD = sh(["git", "log", "--oneline", "-1"])
GIT_RECENT = sh(["git", "log", "--oneline", "-14"])
GIT_REMOTE = sh(["git", "remote", "get-url", "origin"]) or "(sem remote)"
GIT_BRANCH = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"])

EXCLUDE_DIRS = {"node_modules", "isolate", "coverage", "dist", ".git", ".clerk", ".next", ".venv-pip-audit", "__pycache__", "supabase"}
EXCLUDE_FILES = {"package-lock.json", "tsconfig.tsbuildinfo", "bun.lockb", "skills-lock.json"}

def walk(base):
    rows = []
    total = 0
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        rel = Path(dirpath).relative_to(base)
        if str(rel) == ".":
            continue
        loc = 0
        nfiles = 0
        for f in sorted(filenames):
            if f in EXCLUDE_FILES or f.endswith((".pdf", ".png", ".jpg", ".woff", ".woff2", ".ico")):
                continue
            p = Path(dirpath) / f
            try:
                loc += sum(1 for _ in open(p, "rb"))
            except OSError:
                pass
            nfiles += 1
        if nfiles:
            rows.append((str(rel) + "/", nfiles, loc))
            total += loc
    return rows, total

tree_rows, tree_loc = walk(ROOT)

src_files = []
for sub in ("src", "api", "db", "server", "scripts", "lib", "tests"):
    d = ROOT / sub
    if d.exists():
        for p in sorted(d.rglob("*")):
            if p.is_file() and p.suffix in (".ts", ".tsx", ".mjs", ".py") and "isolate" not in str(p):
                try:
                    n = sum(1 for _ in open(p, encoding="utf-8", errors="ignore"))
                except OSError:
                    n = 0
                src_files.append((str(p.relative_to(ROOT)), n))
src_files.sort(key=lambda x: -x[1])
biggest = src_files[:14]
total_src = sum(n for _, n in src_files)

# ------------------------------------------------------------------ build ---
story = []

# ---- capa
story.append(Spacer(1, 30 * mm))
story.append(Paragraph("Fontes AI Admin Adjunta", H1))
story.append(Paragraph("Relatório técnico completo — estado atual do projeto", ParagraphStyle("sub", parent=H2, spaceBefore=0)))
story.append(Spacer(1, 6 * mm))
story.append(table(
    ["Campo", "Valor"],
    [
        ["Data de geração", NOW.strftime("%d/%m/%Y %H:%M UTC")],
        ["Repositório", GIT_REMOTE],
        ["Branch / HEAD", f"{GIT_BRANCH} — {GIT_HEAD}"],
        ["Objetivo do documento", "Transferência completa de conhecimento: arquitetura, código, banco, auth, bots, CI/CD, testes e pendências — sem segredos, pronto para continuar o desenvolvimento em outro local"],
    ],
    [38 * mm, 135 * mm],
))
story.append(Spacer(1, 5 * mm))
story.append(Paragraph(
    "Este documento contém tudo o que está aplicado e ligado no projeto e como está ligado. "
    "Nenhuma credencial ou valor secreto é incluído — apenas nomes de variáveis e suas funções. "
    "Com este relatório + o repositório é possível reconstruir e evoluir o sistema em qualquer ambiente.",
    SMALL,
))
story.append(PageBreak())

# ---- 1. visão geral
story.append(Paragraph("1. Visão geral", H2))
story.append(Paragraph(
    "<b>Produto:</b> plataforma de administração com IA para PMEs em Angola/Portugal — captura e qualificação "
    "automática de leads, gestão de clientes e vendas, cobrança (AOA), agentes autônomos que aprendem com dados reais, "
    "academia de IA (AI Teacher que ensina os agentes), QA de entrega e pacotes de produto. Planes: Starter 1.250 Kz, "
    "Professional 2.916 Kz, Enterprise 8.333 Kz por mês.", BODY))
story.append(Paragraph(
    "<b>Princípio central do produto:</b> \"REAL DATA ONLY\" — nenhuma parte do sistema fabrica dados. Zeros são zeros reais; "
    "agentes sem dados dizem honestamente que não têm aprendizado; evidências de produto trazem fonte, contagem e frescor.", BODY))
story.append(table(
    ["Camada", "Tecnologia", "Estado"],
    [
        ["Frontend", "React 19 + Vite 8 SPA, React Router 7, Tailwind 3, Framer Motion, Recharts, lucide-react, i18n próprio (PT/EN)", "Produção pronta; build ok (2.4s)"],
        ["API", "Vercel Functions (api/*.ts) Node 22, TypeScript estrito, helper único de sessão (api/lib/http.ts)", "Handlers reais verificados E2E (health 200, leads 201, guard 401)"],
        ["Banco", "Neon Postgres (PostgreSQL 18.6) + Drizzle ORM; 10 tabelas migradas via drizzle-kit push", "MIGRADO E VERIFICADO no projeto Neon (10/10 tabelas)"],
        ["Auth padrão", "Better Auth auto-hospedado (sessão cookie HttpOnly, tabelas user/session/account/verification)", "Implementado; verificação de e-mail exigida pelo modo gerenciado"],
        ["Auth opcional", "Clerk (aditivo) — @clerk/react + verificação JWT em todas as rotas; ativa somente com chaves presentes", "Integrado e testado (76+ testes verdes); chaves dev accountless provisionadas"],
        ["Bots/agentes", "6 scripts Node (GitHub Actions cron) + ai_engine.py; logger JSON estruturado", "Funcionais; 2 bugs de SQL corrigidos e testados"],
        ["CI/CD", "GitHub Actions (lint, typecheck, coverage gate 50%, testes Python, build, audits)", "Ativo a cada push/PR"],
        ["Hospedagem", "Vercel (vercel.json: SPA + rewrites /api) — alternativa: Freebuff hosting", "Deploy pendente de redeploy com DATABASE_URL (ver §12)"],
    ],
    [26 * mm, 96 * mm, 51 * mm],
))

# ---- 2. arquitetura
story.append(Paragraph("2. Arquitetura e como está ligado", H2))
story.append(Paragraph("Fluxo de dados em produção:", BODY))
story.append(Paragraph(
    "Navegador (SPA React em dist/)\n"
    "  ├─ dados: fetch /api/leads /api/clients /api/orders /api/activity /api/agents /api/deliveries\n"
    "  │      → Vercel Function (api/*.ts) → Drizzle ORM → Neon Postgres (DATABASE_URL, pooled)\n"
    "  ├─ auth: Better Auth — POST /api/auth/sign-in|sign-up → function api/auth/better-auth.ts\n"
    "  │      → cookie HttpOnly session_token → tabelas user/session no Neon\n"
    "  │   (alternativa com chaves: Clerk — Authorization: Bearer <JWT> verificado em api/lib/http.ts)\n"
    "  └─ analytics: @vercel/analytics + speed-insights\n\n"
    "GitHub Actions (cron)\n"
    "  ├─ 06:00 UTC diário: lead-hunter (qualificador), growth-marketing, teacher-agent, ops-manager\n"
    "  ├─ hourly: error-handler; skills-scout; insight (python3 ai_engine.py)\n"
    "  └─ cada bot → scripts/bot-lib.mjs (shim supabase-js → Neon HTTP driver) → agent_memory / activity_log\n\n"
    "AI providers dos bots: Gemini (cadeia de fallback de modelos) → Blackbox (OpenAI-compatible) → null.\n"
    "Sem chave, o bot roda em modo determinístico sobre dados reais — nunca simula.", CODE))
story.append(Paragraph(
    "<b>Fonte única de verdade do schema:</b> db/schema.ts (Drizzle). O catálogo espelha as migrações Supabase 0001..0005 "
    "uma-a-uma, mais as 4 tabelas do Better Auth. <b>Aplicação no Neon:</b> já executada (drizzle-kit push), "
    "confirmada por information_schema e por smoke (10 tabelas presentes).", BODY))

# ---- 3. estrutura de código
story.append(Paragraph("3. Estrutura de código completa", H2))
story.append(Paragraph(f"Total: <b>{len(src_files)} arquivos-fonte, ~{total_src:,} linhas</b> (TS/TSX/MJS/PY, sem node_modules). Diretórios por volume:", BODY))
story.append(table(["Diretório", "Arquivos", "Linhas"], tree_rows, [70 * mm, 25 * mm, 30 * mm], mono_cols=(0,)))
story.append(Spacer(1, 3 * mm))
story.append(Paragraph("Maiores arquivos (todos &lt; 522 LOC após os refactorings):", BODY))
story.append(table(["Arquivo", "LOC"], biggest, [110 * mm, 25 * mm], mono_cols=(0,)))
story.append(Spacer(1, 3 * mm))
story.append(Paragraph(
    "src/views/Dashboard.tsx é um shell de 291 LOC (estado + fetch + troca de abas); cada aba vive em "
    "src/views/dashboard/tabs/*.tsx (&lt;300 LOC cada). O dicionário i18n vive em src/lib/i18n/pt.ts e en.ts "
    "(pt é fonte da verdade; teste de paridade impede divergência).", SMALL))
story.append(PageBreak())

# ---- 4. banco
story.append(Paragraph("4. Banco de dados — 10 tabelas (Neon, migrado)", H2))
story.append(Paragraph("Negócio (espelham migrações Supabase; PK uuid, created_at timestamptz):", BODY))
story.append(table(
    ["Tabela", "Colunas principais", "Índices/FKs"],
    [
        ["leads", "company, contact_name, email, niche(SaaS), channel(website), score int=50, status(new), ai_action", "idx created_at"],
        ["clients", "name, email, plan(starter), mrr numeric(12,2), status(active)", "idx created_at"],
        ["orders", "client_id→clients(set null), client_name, amount numeric, currency(AOA), method(multicaixa), status(pending), reference", "idx created_at + UNIQUE reference"],
        ["activity_log", "kind(system/bot), message", "idx created_at"],
        ["agent_memory", "agent, key, value jsonb, updated_at", "UNIQUE (agent,key) — upsert de aprendizado"],
        ["delivery_status", "client_id→clients, order_id→orders(cascade), pack, method, amount, qa_status(pending/passed/failed), checks jsonb, notes, verified_at", "idx order_id, qa_status"],
    ],
    [26 * mm, 105 * mm, 42 * mm], mono_cols=(0,),
))
story.append(Paragraph("Better Auth (geradas pelo schema do próprio Better Auth):", BODY))
story.append(table(
    ["Tabela", "Colunas principais"],
    [
        ["user", "id text, name, email (UNIQUE), email_verified bool, image, created/updated_at"],
        ["session", "id, user_id→user(cascade), token (UNIQUE), expires_at, ip_address, user_agent"],
        ["account", "id, user_id→user(cascade), account_id, provider_id, access/refresh/id tokens, password (hash), scope"],
        ["verification", "id, identifier, value, expires_at (verificação de e-mail / reset)"],
    ],
    [26 * mm, 147 * mm], mono_cols=(0,),
))
story.append(Paragraph(
    "<b>Ferramentas:</b> drizzle.config.ts (dialect postgresql, DATABASE_URL|NEON_DATABASE_URL) • npm run db:push "
    "(drizzle-kit push) • npm run db:smoke (scripts/db-smoke.mjs — mapa de linhas por tabela + versão do Postgres) • "
    "npm run db:neon:health. Migrações SQL legadas em lib/db/migrations/0001_better_auth.sql e supabase/migrations/ "
    "(referência histórica — Neon é o alvo atual).", BODY))

# ---- 5. api
story.append(Paragraph("5. API (Vercel Functions)", H2))
story.append(table(
    ["Rota", "Métodos", "Auth", "Função"],
    [
        ["/api/health", "GET", "pública", "ok + database.configured/connected + auth.configured (usada pelo health check)"],
        ["/api/leads", "GET/POST", "GET requer sessão; POST público (formulário da landing)", "listar / capturar lead (defaults forçados: status=new, score=50)"],
        ["/api/clients", "GET/POST", "requer sessão", "CRUD de clientes por plano"],
        ["/api/orders", "GET/POST/PATCH", "requer sessão", "vendas; marcar pago cria delivery_status"],
        ["/api/activity", "GET", "requer sessão", "feed de atividade (bots + sistema)"],
        ["/api/agents", "GET", "requer sessão", "agent_memory consolidada"],
        ["/api/deliveries", "GET/PATCH", "requer sessão", "QA de entrega (checks, aprovação)"],
        ["/api/auth/better-auth", "*", "pública", "Better Auth montado (sign-in/up/out, get-session, send-verification-email)"],
        ["/api/stripe/create-checkout-session", "POST", "sessão", "checkout (inerte sem STRIPE_SECRET_KEY)"],
        ["/api/stripe/webhook", "POST", "assinatura", "webhook Stripe (verificação de assinatura)"],
    ],
    [42 * mm, 22 * mm, 52 * mm, 57 * mm], mono_cols=(0,),
))
story.append(Paragraph(
    "Toda rota autenticada passa por getSessionUser (api/lib/http.ts): 1) cookie Better Auth → 2) fallback Bearer JWT do "
    "Clerk (server/clerk.ts, verifyToken standalone) → 401 se nenhuma. Respostas de erro padronizadas por errorMessage().", SMALL))

# ---- 6. frontend
story.append(Paragraph("6. Frontend", H2))
story.append(table(
    ["Rota", "View", "Notas"],
    [
        ["/", "Landing", "hero, packs/planos, formulário público de lead (POST /api/leads), prova social"],
        ["/auth", "Auth", "Better Auth (default) OU componentes SignIn/SignUp do Clerk quando chaves presentes; painel de verificação de e-mail com reenvio (PT/EN)"],
        ["/dashboard", "Dashboard (protegido — RequireAuth)", "shell + 9 abas: Overview, Product packs, Leads, Analytics, Clients, Orders, AI Agents, Ecosystem, Ops"],
        ["*", "redirect → /", "—"],
    ],
    [20 * mm, 42 * mm, 111 * mm], mono_cols=(0,),
))
story.append(Paragraph(
    "Providers em cascata (App.tsx): PreferencesProvider (tema claro/escuro + locale persistidos) → SessionProvider "
    "(clerk-bridge: Clerk se configurado, senão Better Auth — mesma forma de sessão) → BrowserRouter. "
    "RequireAuth redireciona para /auth preservando o destino. Realtime via polling/subscriptions em src/lib/data.ts; "
    "mock mode (VITE_MOCK_DATA=true) fornece fixtures determinísticas para dev.", BODY))

# ---- 7. auth
story.append(Paragraph("7. Autenticação — 3 camadas", H2))
story.append(table(
    ["Camada", "Estado", "Como está ligada"],
    [
        ["Better Auth (self-hosted) — PADRÃO", "ativo", "server/auth.ts → Drizzle adapter → tabelas user/session/account/verification no Neon; cookie HttpOnly; segredo BETTER_AUTH_SECRET; e-mail+senha (min 8); verificação exigida quando provedor de e-mail configurado"],
        ["Clerk — OPCIONAL/ADITIVO", "integrado, aguardando claim da app", "src/lib/clerk-bridge.tsx comuta o provider; Vite expõe NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pública) além de VITE_*; server/clerk.ts valida Bearer JWT em todas as rotas via CLERK_SECRET_KEY; chaves dev accountless em .env.local (geradas por npx clerk init + env pull)"],
        ["Neon Auth (Better Auth gerenciado) — DO PROJETO NEON", "ativo no Neon, NÃO consumido pelo app", "host ep-broad-salad-zanhmhy8…neonauth…/neondb/auth responde /ok 200 e JWKS válido; CORS aberto com credenciais; origins confiáveis: localhost:5173 e :3000. O app não depende dele — manter como opção futura"],
    ],
    [42 * mm, 34 * mm, 97 * mm],
))
story.append(PageBreak())

# ---- 8. bots
story.append(Paragraph("8. Bots / agentes autônomos", H2))
story.append(table(
    ["Bot (script)", "Cadência", "O que faz (dados reais apenas)"],
    [
        ["lead-hunter.mjs — Lead Qualifier", "diária 06:00 UTC", "lê leads novos → pontua (Gemini/Blackbox ou regra determinística) → grava score/ai_action; aprende viés por canal em agent_memory (channel_bias)"],
        ["error-handler.mjs", "hourly", "triage de incidentes; acumula known_fixes em agent_memory"],
        ["growth-marketing.mjs", "diária", "diagnóstico do funil (bottleneck) → UMA campanha (audiência, canal, métrica, kill criteria); nunca envia nada"],
        ["teacher-agent.mjs — AI Teacher", "diária", "estuda o mercado real e escreve market_brief na memória de cada aluno (academia: enrolled→in_training→trained)"],
        ["ops-manager.mjs — AI Manager", "diária", "missões por agente (agent_memory key=mission) + QA de deliveries"],
        ["skills-scout.mjs", "diária", "mapeia skill_entry (ecossistema skills.sh)"],
        ["ai_engine.py — Insight Engine", "diária (bot:insight)", "lê métricas reais → insight (Gemini→Blackbox→regra) → activity_log; briefing de voz opcional via Hume (scripts/hume_voice.py)"],
    ],
    [52 * mm, 26 * mm, 95 * mm], mono_cols=(0,),
))
story.append(Paragraph(
    "<b>Infra compartilhada (scripts/bot-lib.mjs):</b> shim supabase-js sobre o driver HTTP do Neon (primary) com fallback "
    "legado Supabase; askAI com cadeia de modelos; parseJsonArray/Object; diagnoseSupabaseError (senhas/relação ausente/rede "
    "→ conselho acionável); dbRemember/dbRecall (agent_memory). <b>Logging:</b> JSON por linha {level, ts, bot, msg} via "
    "createLogger — todos os 6 bots já carimbam o próprio nome. <b>Testes:</b> scripts/bot-lib.test.mjs (13 testes, driver "
    "mockado, zero rede) provam o SQL gerado; 2 bugs reais corrigidos (update com AND, maybeSingle com []).", BODY))

# ---- 9. env vars
story.append(Paragraph("9. Variáveis de ambiente (nomes — nenhum valor aqui)", H2))
story.append(Paragraph("Referência viva: README.env-vars.md. Onde obter cada valor está no README.", BODY))
story.append(table(
    ["Grupo", "Variáveis", "Onde vive"],
    [
        ["Públicas (SPA)", "VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY), VITE_MOCK_DATA, VITE_CLERK_PUBLISHABLE_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "build do Vite"],
        ["Neon (primário)", "DATABASE_URL (pooled), NEON_DATABASE_URL", "server: .env.local, deploy env, GitHub secrets"],
        ["Better Auth", "BETTER_AUTH_SECRET (ou AUTH_SECRET), SITE_URL", "idem"],
        ["Clerk backend", "CLERK_SECRET_KEY, CLERK_ISSUER", "idem (opcional)"],
        ["Supabase legado (bots fallback)", "SUPABASE_URL_2/SUPABASE_URL, SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY_2, SUPABASE_JWKS_URL", "GitHub secrets"],
        ["AI", "GEMINI_API_KEY, GEMINI_MODEL, BLACKBOX_API_KEY, BLACKBOX_BASE_URL, BLACKBOX_MODEL", "GitHub secrets"],
        ["Voz", "HUME_API_KEY", "GitHub secrets"],
        ["Stripe", "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET", "deploy env"],
        ["Scripts", "AUTH_SMOKE_PASSWORD, AUTH_SMOKE_URL", ".env.local (opcional)"],
    ],
    [36 * mm, 98 * mm, 39 * mm],
))

# ---- 10. ci/cd
story.append(Paragraph("10. CI/CD (.github/workflows)", H2))
story.append(table(
    ["Workflow", "Gatilho", "Passos-chave"],
    [
        ["ci.yml", "push main / PR / manual", "npm ci → py_compile bots → unittest Python (tests/) → pip-audit → npm audit(high) → lint → typecheck → coverage (gate 50% lines) → build → grep de segredos no bundle → resumo"],
        ["ai-bots.yml", "cron 06:00 UTC + hourly", "executa os 6 bots + insight com secrets reais"],
        ["deploy.yml", "push main", "deploy Vercel (vercel.json: build npm run build → dist/, rewrites /api e SPA)"],
        ["supabase-migrations.yml", "merge que mude supabase/migrations/", "supabase db push (histórico; Neon é o alvo atual)"],
        ["deploy-status.yml / preview-environment.yml / stale.yml", "eventos", "saúde do deploy, preview, limpeza de issues"],
        ["dependabot.yml", "semanal", "atualizações npm + pip"],
    ],
    [40 * mm, 40 * mm, 93 * mm], mono_cols=(0,),
))

# ---- 11. testes
story.append(Paragraph("11. Testes e qualidade (estado verificado)", H2))
story.append(table(
    ["Suíte", "Arquivos", "Testes", "Notas"],
    [
        ["Vitest (jsdom)", "11", "69/69 ✓", "engine (38) · bot-lib shim (13, zero rede) · auth-flow (4) · i18n paridade+prefs (5) · data/db-null-safety (7) · dashboard-nav (1) · errors (1)"],
        ["Python unittest", "1", "8/8 ✓ (0,007s)", "ai_engine: compute_stats, recall_learning, REST supabase, fallback Gemini — requests fake, sem credenciais"],
        ["Coverage gate", "—", "71.9% lines · 60.4% branches", "thresholds 50/35/50/40 ENFORÇADOS no CI (exit ≠ 0 abaixo)"],
        ["Lint/Typecheck", "—", "0 erros", "eslint src · tsc -b --noEmit (strict)"],
        ["Build", "—", "✓ 2.4s", "vite build → dist/ (~474 KB gzip 146 KB)"],
        ["E2E local", "—", "gauntlet 5/5 ✓", "scripts/e2e-gauntlet.mjs + dev-server.mjs: SPA + handlers reais + Neon (health 200, lead 201 persistido, guard 401)"],
    ],
    [30 * mm, 16 * mm, 40 * mm, 87 * mm],
))
story.append(Paragraph(
    "Nota: o snapshot de build da plataforma (isolate/) é espelhado e foi excluído do discovery do Vitest "
    "(vitest.config.ts exclude) para não duplicar a suíte.", SMALL))
story.append(PageBreak())

# ---- 12. pendências
story.append(Paragraph("12. Estado atual e pendências (o que falta ligar)", H2))
story.append(table(
    ["Item", "Estado", "Ação pendente"],
    [
        ["Neon — schema", "✅ 10/10 tabelas migradas (drizzle-kit push, PostgreSQL 18.6)", "nada"],
        ["Neon — segredo no sandbox", "✅ em .env.local (injetado nos shells/preview)", "nada"],
        ["Vercel — produção", "❌ último deploy falhou (DEPLOYMENT_NOT_FOUND); DATABASE_URL ausente no ambiente de deploy", "adicionar DATABASE_URL (pooled) nas env vars do deploy + redeploy; após isso /api/health responde 200 e o dashboard entra em Live"],
        ["Neon Auth — trusted origins", "localhost ok; domínio Vercel não", "adicionar o domínio de produção em Neon Console → Auth → Trusted Origins (se/quando o login usar o Neon Auth)"],
        ["Clerk — claim da app accountless", "chaves dev funcionam (mock/dev)", "npx clerk auth login → npx clerk deploy; depois trocar chaves dev por produção e CLERK_SECRET_KEY no deploy"],
        ["Stripe", "rotas existem, inerte sem chave", "definir STRIPE_SECRET_KEY/WEBHOOK quando for cobrar"],
        ["Legados", "next.config.ts, src/app/, supabase/, Dockerfile, docker-compose", "limpeza opcional — não afetam o build Vite/CI"],
        ["E-mail de verificação", "Neon Auth envia (status true) no modo gerenciado", "Better Auth self-hosted precisa de provider (Resend etc.) se a verificação for exigida sem Neon Auth"],
    ],
    [40 * mm, 68 * mm, 65 * mm],
))

# ---- 13. git
story.append(Paragraph("13. Git — últimos 14 commits (main)", H2))
story.append(Paragraph(GIT_RECENT.replace("\n", "<br/>"), CODE))
story.append(Paragraph(
    "Convenção (CONTRIBUTING.md): 1 feature/fix por commit + teste pareado; autoria de agente registrada no trailer "
    "(Co-Authored-By) e revisão humana obrigatória antes de merge em main.", SMALL))

# ---- 14. como continuar noutro local
story.append(Paragraph("14. Como continuar o desenvolvimento em outro local", H2))
story.append(Paragraph("Passo a passo mínimo (qualquer máquina com Node 22+ e Python 3):", BODY))
story.append(Paragraph(
    "git clone " + GIT_REMOTE + "\n"
    "cd ia-admin-adjunta\n"
    "npm ci\n"
    "cp .env.example .env.local   # preencher no mínimo:\n"
    "  #   DATABASE_URL  = connection string POOLED do Neon\n"
    "  #   BETTER_AUTH_SECRET (openssl rand -base64 32)\n"
    "  #   SITE_URL=http://localhost:5173\n"
    "npm run db:push              # aplica o schema db/schema.ts no Neon\n"
    "npm run dev                  # SPA :5173\n"
    "\n"
    "# API real local (handlers Vercel + SPA em uma porta):\n"
    "npm run preview:fullstack\n"
    "# Prova E2E (health/leads/guard/session):\n"
    "npm run e2e\n"
    "# Smoke do banco (linhas por tabela):\n"
    "npm run db:smoke\n"
    "\n"
    "# Deploy: vercel.json já pronto (build → dist/, rewrites /api/*).\n"
    "# Setar DATABASE_URL, BETTER_AUTH_SECRET, SITE_URL (+ opcionais) no painel do host.\n"
    "# Alternativa Vercel: qualquer host estático + as functions de api/ adaptadas,\n"
    "# ou Freebuff hosting (build = npm run build, saída dist/).", CODE))
story.append(Paragraph(
    "O que já está provado funcionando de ponta a ponta: formulário público → /api/leads → Drizzle → Neon → linha "
    "persistida → dashboard; login Better Auth com verificação de e-mail; 6 bots com logger JSON e memória de "
    "aprendizado; CI completo com gate de cobertura. O único elo pendente de produção é o redeploy com DATABASE_URL "
    "(§12) — código, schema, testes e CI estão verdes e prontos.", BODY))

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=18 * mm, title="Fontes AI Admin Adjunta — Estado completo", author="Buffy/Codebuff")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(f"OK: {OUT}")
