import { ObjectId } from "mongodb";
import { z } from "zod";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ITEMS = 500;
export const validateImportRequestSchema = z.object({
  subjectId: z.string().refine(ObjectId.isValid, "Invalid subjectId"),
  targetExamSetIds: z.array(z.string().refine(ObjectId.isValid, "Invalid exam set id")).max(100),
  inputFormat: z.enum(["json", "structured_text"]),
  content: z.string().min(1).max(MAX_IMPORT_BYTES),
  fileName: z.string().trim().min(1).max(255).optional(),
  options: z.object({
    duplicatePolicy: z.enum(["reject", "skip", "allow"]).default("reject"),
    defaultStatus: z.enum(["draft", "published"]).default("draft"),
    defaultDifficulty: z.enum(["easy", "medium", "hard"]).optional(),
    defaultTranslationStatus: z.enum(["not_required", "pending", "translated", "reviewed", "failed"]).optional(),
  }).default({ duplicatePolicy: "reject", defaultStatus: "draft" }),
}).strict();

export const confirmImportSchema = z.object({ confirmToken: z.string().min(16).max(256) }).strict();
