import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

// Edge-safe: only the shared auth.config.ts (no Prisma, no bcrypt) is
// bundled here. The real authorization for mutations lives in each server
// action — this middleware just sends people to the right pages early.

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

  const needsAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/organizer") ||
    pathname.startsWith("/admin");

  if (needsAuth && !user) {
    const login = new URL("/login", req.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  if (user) {
    if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (
      pathname.startsWith("/organizer") &&
      user.role !== "ORGANIZER" &&
      user.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/organizer/:path*", "/admin/:path*"],
};
