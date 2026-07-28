import { z } from "zod";

export const subjectSchema = z.object({
  code: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  isActive: z.boolean().default(true),
});

export type SubjectInput = z.infer<typeof subjectSchema>;
