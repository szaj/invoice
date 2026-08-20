import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(320)),
  password: z.string().min(1, "Password is required").max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
