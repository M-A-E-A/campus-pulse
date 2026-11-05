import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe Auth.js config: no Prisma, no bcrypt, no Node-only imports.
 *
 * - middleware.ts uses this (Edge runtime can't load Prisma/bcryptjs),
 * - src/lib/auth.ts spreads it and adds the Credentials provider + adapter
 *   for the actual server-side login.
 *
 * The jwt/session callbacks live here so both sides agree on the shape
 * of the session (id + role).
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Auth.js only auto-trusts the host in dev; `next start` would throw
  // UntrustedHost on every request without this. (Behind a real reverse
  // proxy in deployment you'd forward the host header instead.)
  trustHost: true,
  providers: [], // added in src/lib/auth.ts
  callbacks: {
    jwt({ token, user, session, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      // /choose's organizer card promotes through `unstable_update()`, which
      // reaches this callback as `session` with trigger "update" — there is
      // no `user` on that path. Middleware is edge-only (no Prisma) and reads
      // this JWT alone, so the new role has to be written into the token and
      // re-signed here or /organizer would bounce the caller it was just
      // granted access to.
      if (trigger === "update" && session) {
        const role = (session.user?.role ?? session.role) as Role | undefined;
        if (role) token.role = role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
