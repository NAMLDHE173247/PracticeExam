import { z } from "zod";
import { subjectSchema } from "./subject.schema";

export const createSubjectSchema = subjectSchema.omit({ isActive: true }).strict();
export const updateSubjectSchema = z.object({ code: z.string().trim().min(1).transform((value) => value.toUpperCase()).optional(), name: z.string().trim().min(1).optional(), description: z.string().trim().nullable().optional(), isActive: z.boolean().optional() }).strict();
export const subjectQuerySchema = z.object({ search: z.string().trim().optional(), isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional(), sort: z.enum(["name", "createdAt", "updatedAt"]).default("name"), order: z.enum(["asc", "desc"]).default("asc") });
