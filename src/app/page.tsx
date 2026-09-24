import { headers } from "next/headers";
import { auth } from "../../lib/auth";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>IA Admin Adjunta API</h1>
      <p>Neon + Drizzle + Better Auth está configurado.</p>
      <p>{session?.user ? `Sessão ativa para ${session.user.email}` : "Sem sessão autenticada."}</p>
    </main>
  );
}
