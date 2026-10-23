import { z } from "zod";

// Every form and route handler validates through this file.
// Dates arrive from datetime-local inputs as "YYYY-MM-DDTHH:mm" strings;
// we parse them as campus-local time (see tz.ts) before hitting the database.
//
// Messages are DICTIONARY KEYS (common.valid.*): Zod stores the key as the
// issue message, and server actions run it through firstZodMessage() from
// @/i18n/server so the user sees it in their language. Out-of-vocabulary
// issues fall back to Zod's default English text.

export const registerSchema = z.object({
  name: z.string().trim().min(2, "common.valid.nameMin2").max(80),
  email: z.string().trim().toLowerCase().email("common.valid.email"),
  password: z.string().min(8, "common.valid.passwordMin8").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("common.valid.email"),
  password: z.string().min(1, "common.valid.passwordRequired"),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(3, "common.valid.titleMin3").max(120),
    description: z.string().trim().min(10, "common.valid.eventDescMin10").max(5000),
    location: z.string().trim().min(3, "common.valid.locationMin3").max(200),
    startsAt: z.string().min(1, "common.valid.startRequired"),
    endsAt: z.string().min(1, "common.valid.endRequired"),
    capacity: z
      .string()
      .optional()
      .refine((v) => v === undefined || v === "" || (/^\d+$/.test(v) && Number(v) > 0), {
        message: "common.valid.capacityPositive",
      }),
    categoryId: z.string().min(1, "common.valid.categoryRequired"),
    coverImageUrl: z.string().optional(),
  })
  .refine(
    (data) => new Date(`${data.endsAt}:00Z`).getTime() > new Date(`${data.startsAt}:00Z`).getTime(),
    { message: "common.valid.endsAfterStart", path: ["endsAt"] }
  );

export type EventInput = z.infer<typeof eventSchema>;

export const rsvpSchema = z.object({
  eventId: z.string().min(1),
});

export const checkInSchema = z.object({
  eventId: z.string().min(1),
  ticketCode: z.string().trim().min(1, "common.valid.scanRequired").max(100),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, "common.valid.rejectReason").max(500),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "common.valid.nameMin2").max(50),
});

export const clubSchema = z.object({
  name: z.string().trim().min(2, "common.valid.nameMin2").max(80),
  description: z.string().trim().min(10, "common.valid.clubDescMin10").max(1000),
});

export const promoteOrganizerSchema = z.object({
  email: z.string().trim().toLowerCase().email("common.valid.email"),
  clubId: z.string().min(1),
});
