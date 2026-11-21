# IA Admin Adjunta — Plano de estabilização e migração

**Data da revisão:** 2026-11-20  
**Repositório:** `igor1fontes-Panda/ia-admin-adjunta`  
**Branch de trabalho:** `stabilization/neon-better-auth-unification`  
**Branch de produção Git:** `main` (não alterada)  
**Base de dados-alvo:** Neon PostgreSQL  
**Autenticação-alvo:** Neon Managed Better Auth (`@neon/auth`)

## 1. Objectivo e limites

Consolidar a arquitectura numa base sustentável, mantendo Neon como autoridade dos dados e Neon Managed Better Auth como único serviço de identidade e sessão. A migração deve ser incremental, auditável e reversível.

Este documento não autoriza cutover de produção, eliminação de contas, remoção de credenciais, destruição de dados ou alteração de tabelas de produção. Essas operações só ocorrerão após validação técnica e confirmação específica do ponto de cutover.

## 2. Decisões arquitecturais

- Neon PostgreSQL é a fonte de verdade para dados operacionais e memória dos agentes.
- Neon Managed Better Auth, consumido pelo SDK oficial `@neon/auth`, é a única autoridade de autenticação.
- Drizzle gere exclusivamente o schema e as operações de dados empresariais; não gere o schema `neon_auth`.
- Tailwind CSS 4 é a versão CSS de destino.
- Node.js 24.x é a versão de execução padrão dos workflows.
- Os bots não devem alternar silenciosamente entre Neon e Supabase.
- Supabase permanece preservado e sem escrita até a reconciliação e validação estarem concluídas.

## Estado verificado em 21/11/2026

- Neon Managed Better Auth está activo na branch de produção; as 10 identidades existentes residem em `neon_auth`.
- Não é necessária migração de identidades. As tabelas de autenticação duplicadas em `public` permanecem intactas; nenhuma limpeza foi executada.
- O schema empresarial Drizzle foi comparado com `public.leads`, `clients`, `orders`, `activity_log`, `agent_memory` e `delivery_status`: nomes, tipos SQL, nullability, índices secundários e foreign keys coincidem. A comparação da branch isolada com produção também não revelou diferenças.
- A API valida JWTs EdDSA via JWKS, com `iss` e `aud` iguais à origem de `NEON_AUTH_BASE_URL`, e aplica a allowlist administrativa.
- Não foram alterados utilizadores, tabelas ou configurações de autenticação em produção. Não foi executada qualquer migração.
- Antes de um deployment de produção, é necessário rever `allow_sign_up` e `trusted_origins` na configuração Neon. Essa alteração de configuração permanece pendente de autorização específica.

## 3. Protecção efectuada em 20/11/2026

- Criado snapshot manual Neon `pre-stabilization-2026-11-20` (snapshot `snap-dry-tree-za1urejo`) a partir da branch `production`.
- Criada branch Neon isolada `stabilization-preflight-2026-11-20` (branch `br-dry-sound-zaumilln`), derivada de `production`, pronta e sem compute.
- Criada branch Git `stabilization/neon-better-auth-unification` a partir de `main`.
- Nenhuma alteração foi feita em `main`, nas tabelas de produção, nos utilizadores ou nas credenciais.
- O snapshot Neon não substitui um backup independente do projecto Supabase. Antes de qualquer escrita no Supabase, obter e verificar um backup/export próprio.

## 4. Evidência de dados — leads

Foram comparados fingerprints MD5 de ID, email normalizado e empresa normalizada, sem expor os valores originais.

| Origem                  | Registos | Resultado                                                               |
| ----------------------- | -------: | ----------------------------------------------------------------------- |
| Neon `public.leads`     |        4 | Quatro fingerprints de ID distintos                                     |
| Supabase `public.leads` |        1 | Fingerprints de ID, email e empresa não coincidem com os quatro do Neon |

O lead Supabase tem estado `lost` e score 55; os quatro leads Neon têm estado `new` e score 50. As fingerprints de email e empresa também não coincidem. Portanto, não há evidência de duplicação entre o registo Supabase e os quatro registos Neon. A decisão provisória é preservar os cinco registos e não importar, fundir ou eliminar nenhum até validação de negócio e confirmação de integridade referencial.

## 5. Autenticação — arquitectura de destino e preservação

A autenticação já existe em Neon Managed Auth; não se deve migrar as dez identidades existentes para uma instância Better Auth auto-gerida.

- Usar o SDK oficial `@neon/auth` no frontend Vite.
- Validar os JWTs de sessão nas Vercel Functions por JWKS/EdDSA e allowlist administrativa.
- Manter Drizzle apenas para as seis tabelas empresariais públicas.
- Preservar as tabelas de autenticação duplicadas em `public` sem as mapear ou apagar.
- Não executar migrações nem alterar identidades em produção nesta fase.
- Antes de deployment, rever `allow_sign_up` e `trusted_origins` no Managed Auth; qualquer alteração de configuração de produção requer aprovação específica.

## 6. Dados e schema

- A comparação de produção em 21/11/2026 confirmou PKs, colunas, tipos, nullability, índices e foreign keys nas seis tabelas empresariais; manter esse teste de regressão.
- Comparar futuras alterações por PK, chaves naturais, timestamps e relações.
- Preservar os registos de origem; preferir importação idempotente e auditável.
- Resolver divergências de constraints entre Supabase e Neon antes de alterar schema.
- Incorporar constraints CHECK e índices validados no schema Drizzle.
- Nesta fase, não criar nem executar migrações: a comparação do schema empresarial com produção não demonstrou diferenças.
- Só propor uma migração versionada se uma alteração futura de código exigir colunas, índices ou constraints que não existam em produção; apresentar diff e plano de rollback antes de qualquer execução.
- Garantir atomicidade na criação de `orders` e `delivery_status`.
- Validar UUIDs e referências antes das escritas.
- Não migrar tabelas de template ou demonstração sem dependência funcional comprovada.

## 7. Bots e workflows

Bots identificados: `lead-hunter.mjs`, `ops-manager.mjs`, `growth-marketing.mjs`, `teacher-agent.mjs`, `error-handler.mjs`, `skills-scout.mjs` e `ai_engine.py`.

Trabalho obrigatório:

1. Mapear cada bot, workflow, tabela, integração, secret referenciado e permissões.
2. Migrar `ai_engine.py` de Supabase REST para o acesso Neon aprovado.
3. Configurar explicitamente `DATABASE_URL`/variável Neon apropriada nos workflows.
4. Remover fallback automático Neon → Supabase depois de todos os testes.
5. Alinhar workflows Node a Node 24.x e fixar versão de npm.
6. Fazer falhas reais devolverem exit code não-zero; não permitir CI verde com tarefas falhadas.
7. Confirmar se Supabase Storage é ainda necessário e decidir migração independente dos objectos.
8. Executar testes isolados na branch Neon de preflight; não usar produção para testes de escrita.

## 8. API e segurança

- Tornar a criação de encomenda e QA transaccional.
- Validar `client_id` como UUID.
- Fortalecer o health check para testar DB e configuração/autenticação real sem revelar segredos.
- Aplicar rate limiting e validação de abuso no checkout Stripe, se a exposição pública se mantiver.
- Preservar a validação de assinatura e a idempotência do webhook Stripe.
- Formalizar privilégios PostgreSQL mínimos; rever grants de roles antes de qualquer exposição directa.
- Corrigir políticas RLS Supabase enquanto Supabase permanecer acessível, incluindo leitura pública de `agent_memory`, sem assumir que Neon necessita do mesmo modelo de RLS.

## 9. Build e CI/CD

- Corrigir Tailwind 4 integralmente: plugin PostCSS, CSS de entrada e configuração legacy.
- Sincronizar `package-lock.json` através de npm, sem edição manual de resoluções.
- Uniformizar Node 24.x em todos os workflows.
- Rever triggers e agendamentos de GitHub Actions.
- Corrigir health checks que aceitam apenas redirects como sinal de sucesso.
- Validar lint, format, typecheck, tests, coverage, build, smoke tests e autenticação.
- Validar deployment Preview antes de qualquer promoção para produção.

## 10. Critérios de aceitação

- Contagens e fingerprints reconciliados; zero perda e zero duplicação não explicada.
- Todas as identidades têm acesso validado ou procedimento de recuperação concluído.
- Nenhum bot depende de Supabase para dados operacionais.
- Nenhum fallback silencioso entre bases.
- Migrações repetíveis e verificadas numa branch isolada.
- Testes unitários, integração, auth, Stripe, bots e build aprovados.
- GitHub Actions verde e Preview validado.
- Plano de rollback ensaiado e backups verificáveis.

## 11. Reversão

- Manter snapshot Neon e Supabase intactos.
- Manter Supabase sem alterações durante reconciliação e validação.
- Não apagar utilizadores, tabelas, buckets, secrets ou dados de origem durante a transição.
- Manter a versão anterior de API e configuração até o cutover ser validado.
- Se login falhar, reverter o encaminhamento de autenticação e activar recuperação; não eliminar identidades antigas.
- Se contagens, fingerprints ou relações divergirem, suspender importação/cutover e preservar ambas as origens.

## 12. Próximas tarefas

1. Inventariar as 11 identidades de autenticação por fingerprints e metadados não sensíveis.
2. Rever grants/roles completos no Neon e políticas RLS/grants Supabase.
3. Fazer inventário completo dos workflows e secrets por nome, nunca pelo valor.
4. Rever os módulos de autenticação e todos os bots na branch de estabilização.
5. Preparar migrations e testes em branch isolada.
6. Só depois planear o cutover com janela, validação e rollback explícitos.

## 13. Auditoria histórica de autenticação e bots — 20/11/2026

> **Nota:** esta auditoria descreve o estado anterior à consolidação. Os caminhos e achados de autenticação abaixo são históricos e foram substituídos pela arquitectura Neon Managed Auth documentada no início deste ficheiro. Não representam ficheiros activos no estado de 21/11/2026.

### Autenticação

Ficheiros revistos:

- `server/auth.ts`
- `api/lib/http.ts`
- `api/auth/better-auth.ts`
- `src/lib/auth-client.ts`
- `server/clerk.ts`
- `lib/auth.ts`
- `lib/db/schema.ts`
- `db/index.ts`
- `db/schema.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/page.tsx`

Achados:

1. `server/auth.ts` é a implementação Better Auth ligada ao schema Drizzle Neon principal.
2. `api/auth/better-auth.ts` mantém dois modos: proxy Neon Managed Auth via `VITE_NEON_AUTH_URL` e Better Auth auto-gerido. A variável VITE também é exposta ao bundle do cliente.
3. `api/lib/http.ts` tenta Better Auth e depois Clerk Bearer; `server/clerk.ts` mantém uma integração activa de fallback.
4. `src/lib/auth-client.ts` define `NEON_AUTH` a partir de `VITE_NEON_AUTH_URL`, pelo que a interface ainda contém comportamento dependente do modo Managed Auth.
5. Existe uma segunda instância em `lib/auth.ts`, usada pela superfície Next.js, com `pg` e schema camelCase fisicamente diferente do schema snake_case de `db/schema.ts`.
6. `src/app/api/auth/[...all]/route.ts` encaminha directamente para Better Auth via `toNextJsHandler`, sem passar pelo controlo `enforceAdminIdentity` do handler Vercel. A superfície Next.js deve ser consolidada ou desactivada, não deixada como segundo caminho de autenticação.
7. `server/auth.ts` activa email/password mas não configura explicitamente envio de recuperação de palavra-passe. A recuperação exige provider de email e teste end-to-end.
8. O bootstrap administrativo tem de ser fechado de forma controlada antes de abrir o endpoint de registo; não copiar credenciais nem hashes sem validação.

Decisão de implementação:

- Uma única instância Better Auth e um único schema Drizzle.
- Um único caminho de autenticação usado pela SPA e por qualquer handler Next.js que permaneça activo.
- Retirar Neon Managed Auth e Clerk apenas depois de migração, login, recuperação e autorização testados.
- Configurar recuperação de password e convite/bootstrap administrativo antes do cutover.

### Bots e persistência

Bots revistos:

- `scripts/lead-hunter.mjs`
- `scripts/ops-manager.mjs`
- `scripts/growth-marketing.mjs`
- `scripts/teacher-agent.mjs`
- `scripts/error-handler.mjs`
- `scripts/skills-scout.mjs`
- `ai_engine.py`

Camadas de dados:

- `scripts/bot-lib.mjs` implementa um shim Supabase-like sobre Neon, mas cai para Supabase se Neon não estiver configurado ou se uma query Neon falhar. Isso permite split-brain durante falhas.
- `scripts/bot-db.mjs` contém uma segunda implementação e usa Supabase quando Neon não está configurado. O lead-hunter usa esta camada e importa também o bot-lib para IA.
- Os outros cinco bots JS usam o shim `supabase.from(...)` do `bot-lib.mjs`, apesar de a persistência principal ser Neon.
- `ai_engine.py` usa Supabase REST directamente para leads, clients, orders, agent_memory e activity_log. Não usa Neon.
- `scripts/hume_voice.py` usa Supabase Storage para publicar briefings de voz. Esta é uma dependência de object storage, não de base de dados, e precisa de migração própria ou de credenciais Storage separadas antes de remover todos os segredos Supabase.

Fiabilidade:

- Os seis bots JavaScript contêm caminhos de saída com `process.exit(0)` em situações sem configuração e/ou erro fatal. A política actual pode marcar execuções falhadas como sucesso.
- `ai_engine.py` devolve código 0 quando não há configuração ou quando falha leitura de dados.
- O teste `scripts/bots-null-safety.test.mjs` espera saída 0 para ausência de credenciais; deverá ser reescrito para distinguir execução intencionalmente ignorada (skip explícito) de erro operacional.
- O shim constrói nomes de tabelas/colunas dinamicamente. Antes de o manter, validar identificadores contra allow-list e manter valores parametrizados.
- `bot-lib.test.mjs` cobre o SQL gerado e falhas simuladas, mas não prova integração real, transacções ou ausência de fallback para outro servidor.

### Workflows

Ficheiros revistos:

- `.github/workflows/ai-bots.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/supabase-migrations.yml`
- `.github/workflows/preview-environment.yml`

Achados:

1. `ai-bots.yml` passa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para os seis jobs JS e para o job Python; não fornece `DATABASE_URL` nem `NEON_DATABASE_URL`.
2. Os seis jobs JS usam Node 22, apesar de `package.json` declarar Node 24 e o workflow CI principal já usar Node 24.
3. `deploy.yml` também usa Node 22.
4. `supabase-migrations.yml` continua configurado para fazer `supabase db push` em `main` quando há alterações nas migrações Supabase e o secret está presente. Este workflow deve ser desactivado/retirado apenas quando o fluxo de migrações Neon estiver implementado e verificado.
5. O CI principal usa Node 24 e executa testes Python, lint, typecheck, coverage e build. A validação por PR pode ser usada como gate da branch de estabilização.
6. Não foi possível consultar os valores nem a existência efectiva dos GitHub Secrets; nenhum valor secreto foi lido ou exposto.

### Dependência de armazenamento de voz

`scripts/hume_voice.py` carrega áudio gerado pela Hume para o bucket Supabase Storage `briefings`. Não remover credenciais Supabase indiscriminadamente. Opções técnicas para decidir na fase seguinte:

- manter temporariamente uma credencial restrita exclusivamente a Storage, separada das credenciais de base de dados; ou
- migrar os ficheiros para um object store escolhido (por exemplo, Vercel Blob ou S3 compatível), validar URLs e playback e só então retirar a dependência Storage.

### Bloqueios antes da implementação

- Definir provider transaccional de email para reset/invite Better Auth.
- Confirmar a decisão de manter ou migrar Supabase Storage para briefings.
- Inventariar de forma não sensível os 11 utilizadores de origem e os providers associados.
- Preparar adapter Python PostgreSQL (dependência e conexão Neon) e testes sem acesso à produção.
- Definir exit codes e semântica de skip/failure para os bots.
- Consolidar a superfície Next.js e garantir que não há bypass do controlo administrativo.
