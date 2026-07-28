import { ObjectId } from "mongodb";
import { z } from "zod";

const objectIdSchema = z.string().refine(ObjectId.isValid, "Invalid ObjectId");

export const examSetSchema = z.object({
  subjectId: objectIdSchema,
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  durationMinutes: z.number().int().positive().optional(),
  passingScore: z.number().min(0).max(100).optional(),
});

export type ExamSetInput = z.infer<typeof examSetSchema>;
