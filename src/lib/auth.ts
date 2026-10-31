import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { authConfig } from "@/auth.config";
import { loginLimiter, loginKey, LOGIN_LIMIT } from "@/lib/rate-limit";
import type { Role } from "@prisma/client";

// Full config for the server: real credentials check against the database.
// Middleware loads only auth.config.ts (see src/middleware.ts).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Locked accounts fail exactly like wrong passwords — returning the
        // same null keeps a locked email indistinguishable from a bad one
        // on this raw callback path (the UI shows the honest message).
        const key = loginKey(parsed.data.email);
        if (loginLimiter.exceeded(key, LOGIN_LIMIT.limit)) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        // Success forgives the failures behind them.
        loginLimiter.clear(key);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});

// ---- Role helpers used by server components and actions ----
// UI checks are cosmetic; these are the real gate.

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireRole(role: Role) {
  const user = await requireUser();
  if (user.role !== role) throw new Error("FORBIDDEN");
  return user;
}

/** True when the user belongs to the club (via ClubMember) or is an admin. */
export async function isClubOrganizer(userId: string, clubId: string): Promise<boolean> {
  const [membership, user] = await Promise.all([
    prisma.clubMember.findUnique({
      where: { userId_clubId: { userId, clubId } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  return Boolean(membership) || user?.role === "ADMIN";
}
