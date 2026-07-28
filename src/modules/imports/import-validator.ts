import { ObjectId, type Collection } from "mongodb";
import { createQuestionContentHash } from "../questions/question-hash";
import { questionSchema } from "../questions/question.schema";
import type { QuestionDocument } from "../questions/question.types";
import type { DuplicatePolicy, ImportPreviewItem } from "./question-import.types";
import type { ParsedImportItem } from "./import-parser-json";
import type { ImportDefaults } from "./import-normalizer";
import { normalizeImportQuestion } from "./import-normalizer";

export async function validateImportItems(items: ParsedImportItem[], subjectId: string, targetExamSetIds: string[], defaults: ImportDefaults, duplicatePolicy: DuplicatePolicy, questions: Collection<QuestionDocument>): Promise<ImportPreviewItem[]> {
  const previews: Array<ImportPreviewItem | undefined> = new Array(items.length); const batch = new Map<string, number>(); const candidates: Array<{ index: number; item: ParsedImportItem; normalized: QuestionDocument; hash: string }> = [];
  for (const item of items) {
    const issues = [...item.parseIssues]; if (!item.normalizedQuestion) { previews[item.itemIndex] = { itemIndex: item.itemIndex, status: "invalid", issues }; continue; }
    const normalized = normalizeImportQuestion(item.normalizedQuestion, subjectId, targetExamSetIds, defaults); const result = questionSchema.safeParse(normalized);
    if (issues.some((issue) => issue.severity === "error")) { previews[item.itemIndex] = { itemIndex: item.itemIndex, status: "invalid", normalizedQuestion: item.normalizedQuestion, issues }; continue; }
    if (!result.success) { previews[item.itemIndex] = { itemIndex: item.itemIndex, status: "invalid", normalizedQuestion: item.normalizedQuestion, issues: [...issues, ...result.error.issues.map((issue) => ({ itemIndex: item.itemIndex, field: issue.path.join("."), code: "INVALID_FIELD", message: issue.message, severity: "error" as const }))] }; continue; }
    const hash = createQuestionContentHash(result.data); const previous = batch.get(hash);
    if (previous !== undefined) { const status = duplicatePolicy === "skip" ? "skipped" : duplicatePolicy === "allow" ? "valid" : "duplicate_in_batch"; previews[item.itemIndex] = { itemIndex: item.itemIndex, status, normalizedQuestion: result.data, contentHash: hash, issues: [{ itemIndex: item.itemIndex, code: "DUPLICATE_WITHIN_IMPORT", message: `Trùng với item ${previous}.`, severity: duplicatePolicy === "reject" ? "error" : "warning" }] }; continue; }
    batch.set(hash, item.itemIndex); candidates.push({ index: item.itemIndex, item, normalized: result.data as unknown as QuestionDocument, hash });
  }
  const hashes = candidates.map((candidate) => candidate.hash); const existingByHash = new Map<string, QuestionDocument>();
  if (hashes.length) for (const existing of await questions.find({ subjectId: new ObjectId(subjectId), contentHash: { $in: hashes } }).project({ _id: 1, contentHash: 1 }).toArray()) { const typedExisting = existing as unknown as QuestionDocument; existingByHash.set(typedExisting.contentHash, typedExisting); }
  for (const candidate of candidates) {
    const existing = existingByHash.get(candidate.hash); if (existing) { const status = duplicatePolicy === "skip" ? "skipped" : duplicatePolicy === "allow" ? "valid" : "duplicate_in_database"; previews[candidate.index] = { itemIndex: candidate.index, status, normalizedQuestion: candidate.normalized, contentHash: candidate.hash, duplicateQuestionId: existing._id, issues: [{ itemIndex: candidate.index, code: "DUPLICATE_IN_DATABASE", message: "Câu hỏi đã tồn tại trong database.", severity: duplicatePolicy === "reject" ? "error" : "warning" }] }; continue; }
    previews[candidate.index] = { itemIndex: candidate.index, status: "valid", normalizedQuestion: candidate.normalized, contentHash: candidate.hash, issues: candidate.item.parseIssues };
  }
  return previews.filter((item): item is ImportPreviewItem => item !== undefined);
}
