import { z } from "zod";
import { examSetSchema } from "./exam-set.schema";

export const createExamSetSchema = examSetSchema.omit({ status: true }).extend({ defaultDurationMinutes: z.number().int().min(1).max(600).optional(), passingScore: z.number().min(0).max(10).optional(), status: z.enum(["draft", "published"]).optional() });
export const updateExamSetSchema = z.object({ subjectId: z.string().optional(), title: z.string().trim().min(1).optional(), description: z.string().trim().nullable().optional(), defaultDurationMinutes: z.number().int().min(1).max(600).nullable().optional(), passingScore: z.number().min(0).max(10).nullable().optional(), status: z.enum(["draft", "published", "archived"]).optional() }).strict();
export const examSetQuerySchema = z.object({ subjectId: z.string().optional(), status: z.enum(["draft", "published", "archived"]).optional(), search: z.string().trim().optional(), sort: z.enum(["title", "createdAt", "updatedAt", "questionCount"]).default("createdAt"), order: z.enum(["asc", "desc"]).default("desc") });
