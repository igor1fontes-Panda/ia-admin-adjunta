const baseUrl = (process.env.AUTH_SMOKE_URL || "http://localhost:3000").replace(/\/$/, "")
const email = `smoke-${Date.now()}@example.invalid`
const password = process.env.AUTH_SMOKE_PASSWORD || `smoke-${crypto.randomUUID()}`

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { response, body }
}

const session = await request("/api/auth/get-session")
if (![200, 401].includes(session.response.status)) {
  throw new Error(`get-session returned ${session.response.status}: ${JSON.stringify(session.body)}`)
}

const signIn = await request("/api/auth/sign-in/email", {
  method: "POST",
  body: JSON.stringify({ email, password }),
})
if (![400, 401, 404, 503].includes(signIn.response.status)) {
  throw new Error(`sign-in contract returned unexpected ${signIn.response.status}: ${JSON.stringify(signIn.body)}`)
}

console.log(`[auth-smoke] ${baseUrl} responded correctly for session and sign-in contract.`)
console.log(`[auth-smoke] get-session=${session.response.status} sign-in=${signIn.response.status}`)
console.log("[auth-smoke] This test does not create a user or write database data.")
