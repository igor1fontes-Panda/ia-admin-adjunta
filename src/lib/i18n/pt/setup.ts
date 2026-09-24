export const setup = {
  title: "Ligação à base de dados necessária",
  sub: "Esta app funciona apenas com dados reais — sem modo demo, sem simulações.",
  alert:
    "A base Neon Postgres ainda não está ligada nesta implantação, pelo que os dados autenticados, a persistência e a entrega autónoma estão pausados. Não são mostrados leads, compradores ou outreach falsos.",
  hint: "Podes rever o fluxo de pacotes de produto a partir da pré-visualização pública. Confirma `DATABASE_URL` e `BETTER_AUTH_SECRET` no ambiente Vercel e aplica a migração Neon quando estiveres pronto para ativar armazenamento real, sessões e outreach com consentimento.",
};
