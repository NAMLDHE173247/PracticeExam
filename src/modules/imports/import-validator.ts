import { ObjectId, type Collection } from "mongodb";
import { createQuestionContentHash } from "../questions/question-hash";
import { questionSchema } from "../questions/question.schema";
import type { QuestionDocument } from "../questions/question.types";
import type { DuplicatePolicy, ImportPreviewItem } from "./question-import.types";
import type { ParsedImportItem } from "./import-parser-json";
import type { ImportDefaults } from "./import-normalizer";
import { normalizeImportQuestion } from "./import-normalizer";

export async function validateImportItems(items: ParsedImportItem[], subjectId: string, targetExamSetIds: string[], defaults: ImportDefaults, duplicatePolicy: DuplicatePolicy, questions: Collection<QuestionDocument>): Promise<ImportPreviewItem[]> {
  const previews: ImportPreviewItem[] = []; const batch = new Map<string, number>();
  for (const item of items) {
    const issues = [...item.parseIssues]; if (!item.normalizedQuestion) { previews.push({ itemIndex: item.itemIndex, status: "invalid", issues }); continue; }
    const normalized = normalizeImportQuestion(item.normalizedQuestion, subjectId, targetExamSetIds, defaults); const result = questionSchema.safeParse(normalized);
    if (issues.some((issue) => issue.severity === "error")) { previews.push({ itemIndex: item.itemIndex, status: "invalid", normalizedQuestion: item.normalizedQuestion, issues }); continue; }
    if (!result.success) { previews.push({ itemIndex: item.itemIndex, status: "invalid", normalizedQuestion: item.normalizedQuestion, issues: [...issues, ...result.error.issues.map((issue) => ({ itemIndex: item.itemIndex, field: issue.path.join("."), code: "INVALID_FIELD", message: issue.message, severity: "error" as const }))] }); continue; }
    const hash = createQuestionContentHash(result.data); const previous = batch.get(hash); if (previous !== undefined) { const status = duplicatePolicy === "skip" ? "skipped" : duplicatePolicy === "allow" ? "valid" : "duplicate_in_batch"; previews.push({ itemIndex: item.itemIndex, status, normalizedQuestion: result.data, contentHash: hash, issues: [{ itemIndex: item.itemIndex, code: "DUPLICATE_WITHIN_IMPORT", message: `Trùng với item ${previous}.`, severity: duplicatePolicy === "allow" || duplicatePolicy === "skip" ? "warning" : "error" }] }); continue; }
    batch.set(hash, item.itemIndex); const existing = await questions.findOne({ subjectId: new ObjectId(result.data.subjectId), contentHash: hash });
    if (existing) { const status = duplicatePolicy === "skip" ? "skipped" : duplicatePolicy === "allow" ? "valid" : "duplicate_in_database"; previews.push({ itemIndex: item.itemIndex, status, normalizedQuestion: result.data, contentHash: hash, duplicateQuestionId: existing._id, issues: [{ itemIndex: item.itemIndex, code: "DUPLICATE_IN_DATABASE", message: "Câu hỏi đã tồn tại trong database.", severity: duplicatePolicy === "allow" || duplicatePolicy === "skip" ? "warning" : "error" }] }); continue; }
    previews.push({ itemIndex: item.itemIndex, status: "valid", normalizedQuestion: result.data, contentHash: hash, issues });
  }
  return previews;
}
