# Revisão de segurança — Neon e Supabase

Estado: proposta para revisão; não aplicada a qualquer base de dados.

## Critério de autorização administrativa

Usar a claim de função administrativa em `app_metadata` como condição de autorização:

```sql
(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
```

A expressão deve ser aplicada em políticas RLS adequadas a cada tabela e operação. Não usar `USING (true)` para conceder leitura ou escrita geral a todos os utilizadores autenticados.

## Requisitos antes de aplicar

- Ativar RLS em todas as tabelas expostas pela API.
- Definir políticas separadas por operação (SELECT, INSERT, UPDATE e DELETE).
- Restringir leitura/escrita administrativa à condição acima.
- Manter INSERT público apenas nas tabelas e colunas estritamente necessárias, com validação no servidor.
- Rever especificamente `agent_memory` e `delivery_status`; não presumir que as políticas de outras tabelas as protegem.
- Verificar privilégios SQL e exposição pela Data API do Neon; RLS no Supabase não protege automaticamente o Neon.
- Testar utilizador anónimo, autenticado comum e administrador; confirmar que apenas o administrador acede às operações administrativas.
- Rever migrações e estado aplicado antes de executar qualquer migração. Não executar `db:push` como substituto dessa reconciliação.

## Limites desta proposta

Este documento não altera RLS, grants, roles, Data API, autenticação, sessões, dados ou configurações de produção. A condição de autorização é um requisito de desenho e deve ser validada contra o modelo de claims efetivamente emitido pelo sistema de autenticação.
