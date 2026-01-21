import { auth } from "./server";

export async function verifyCredentials(request: Request): Promise<Response> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    console.error("[Auth Service] verify-credentials: missing BETTER_AUTH_SECRET");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const provided = request.headers.get("x-internal-auth");
  if (!provided || provided !== secret) {
    console.warn("[Auth Service] verify-credentials: invalid internal auth header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { email?: string; password?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const email = body?.email;
  const password = body?.password;
  const safeEmail = typeof email === "string" ? email.replace(/^(.).+(@.+)$/, "$1***$2") : "unknown";

  if (!email || !password || typeof email !== "string" || typeof password !== "string" || !email.includes("@")) {
    console.warn("[Auth Service] verify-credentials: invalid body", { email: safeEmail });
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let user: any = null;
  try {
    console.log(`[Auth Service] verify-credentials: attempting sign-in for ${safeEmail}`);
    const result: any = await auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe: false,
      },
      headers: request.headers,
    });
    user = result?.user ?? result?.session?.user ?? null;
    if (user) {
      console.info(`[Auth Service] verify-credentials: sign-in successful`, { userId: user.id, email: safeEmail });
    } else {
      console.warn(`[Auth Service] verify-credentials: sign-in ok but no user`, { email: safeEmail });
    }
  } catch (error) {
    console.warn(`[Auth Service] verify-credentials: sign-in failed`, { email: safeEmail, error: error instanceof Error ? error.message : "Unknown error" });
    user = null;
  }

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      user,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
