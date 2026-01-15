import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";

type RequestBody = {
  email?: string;
  password?: string;
};

export const Route = createFileRoute("/api/auth/verify-credentials" as any)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.BETTER_AUTH_SECRET;
        if (!secret) {
          console.error("[auth] verify-credentials: missing BETTER_AUTH_SECRET");
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const provided = request.headers.get("x-internal-auth");
        if (!provided || provided !== secret) {
          console.warn("[auth] verify-credentials: invalid internal auth header");
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: RequestBody | null = null;
        try {
          body = await request.json();
        } catch {
          body = null;
        }

        const email = body?.email;
        const password = body?.password;
        const safeEmail = typeof email === "string" ? email.replace(/^(.).+(@.+)$/, "$1***$2") : "unknown";

        if (!email || !password || typeof email !== "string" || typeof password !== "string" || !email.includes("@")) {
          console.warn("[auth] verify-credentials: invalid body", { email: safeEmail });
          return new Response(JSON.stringify({ error: "Invalid credentials" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let user: any = null;
        try {
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
            console.info("[auth] verify-credentials: sign-in ok", { userId: user.id, email: safeEmail });
          } else {
            console.warn("[auth] verify-credentials: sign-in ok but no user", { email: safeEmail });
          }
        } catch {
          console.warn("[auth] verify-credentials: sign-in failed", { email: safeEmail });
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
      },
    },
  },
});
