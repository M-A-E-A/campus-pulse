"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { getT, firstZodMessage } from "@/i18n/server";

export type FormState = { error?: string } | null;

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: await firstZodMessage(parsed.error) };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    const t = await getT();
    return { error: t("auth.error.emailTaken") };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      // Everyone registers as a student. Admins promote organizers.
      role: "STUDENT",
    },
  });

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
  return null;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: (formData.get("from") as string) || "/dashboard",
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      const t = await getT();
      return { error: t("auth.error.invalidCredentials") };
    }
    throw error; // NEXT_REDIRECT must propagate
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
