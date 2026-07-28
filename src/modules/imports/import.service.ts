import { createHash, randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import { getCollection, runInTransaction } from "../../lib/mongodb";
import { ApiError, parseObjectId } from "../../lib/api/response";
import { questionSchema } from "../questions/question.schema";
import type { QuestionDocument } from "../questions/question.types";
import { QuestionImportRepository } from "./import.repository";
import { confirmImportSchema, MAX_IMPORT_BYTES, MAX_IMPORT_ITEMS, validateImportRequestSchema } from "./import.schema";
import { parseJsonImport } from "./import-parser-json";
import { parseStructuredText } from "./import-parser-structured-text";
import type { ImportPreviewItem, QuestionImportJobDocument } from "./question-import.types";
import { validateImportItems } from "./import-validator";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const publicItem = (item: ImportPreviewItem) => { const question = item.normalizedQuestion as { type?: string; content?: unknown; options?: unknown[]; statements?: unknown[]; difficulty?: string; tags?: string[] } | undefined; return { itemIndex: item.itemIndex, questionNumber: item.questionNumber, status: item.status, contentHash: item.contentHash, duplicateQuestionId: item.duplicateQuestionId, preview: question ? { type: question.type, content: question.content, optionCount: question.options?.length, statementCount: question.statements?.length, difficulty: question.difficulty, tags: question.tags ?? [] } : undefined, issues: item.issues }; };

export class QuestionImportService {
  constructor(private readonly jobs: QuestionImportRepository, private readonly subjects = getCollection("subjects"), private readonly examSets = getCollection("exam_sets"), private readonly questions = getCollection("questions")) {}

  private async validateRelations(subjectId: ObjectId, targetExamSetIds: ObjectId[]) {
    const subject = await (await this.subjects).findOne({ _id: subjectId }); if (!subject) throw new ApiError("INVALID_RELATION", "Subject không tồn tại."); if (!subject.isActive) throw new ApiError("CONFLICT", "Subject đã bị vô hiệu hóa.");
    const sets = await (await this.examSets).find({ _id: { $in: targetExamSetIds } }).toArray(); if (sets.length !== targetExamSetIds.length) throw new ApiError("INVALID_RELATION", "Một hoặc nhiều exam set không tồn tại."); if (sets.some((set) => !set.subjectId.equals(subjectId))) throw new ApiError("INVALID_RELATION", "Exam sets phải cùng subject."); if (sets.some((set) => set.status === "archived")) throw new ApiError("CONFLICT", "Không thể import vào exam set archived.");
  }

  async validate(input: unknown) {
    const request = validateImportRequestSchema.parse(input); if (Buffer.byteLength(request.content, "utf8") > MAX_IMPORT_BYTES) throw new ApiError("IMPORT_TOO_LARGE", "Nội dung import vượt quá 5MB.", undefined, 413);
    const subjectId = parseObjectId(request.subjectId, "subjectId"); const targetExamSetIds = request.targetExamSetIds.map((id) => parseObjectId(id, "examSetId")); await this.validateRelations(subjectId, targetExamSetIds);
    const parsed = request.inputFormat === "json" ? parseJsonImport(request.content) : parseStructuredText(request.content); const rootIssues = "rootIssues" in parsed ? parsed.rootIssues : parsed.rootIssue ? [parsed.rootIssue] : [];
    const limitIssues = parsed.items.length > MAX_IMPORT_ITEMS ? [{ code: "TOO_MANY_ITEMS", message: `Mỗi import job tối đa ${MAX_IMPORT_ITEMS} câu hỏi.`, severity: "error" as const }] : []; const items = parsed.items.slice(0, MAX_IMPORT_ITEMS); const allRootIssues = [...rootIssues, ...limitIssues]; const previews = allRootIssues.length ? [] : await validateImportItems(items, request.subjectId, request.targetExamSetIds, request.options, request.options.duplicatePolicy, await this.questions);
    const issues = [...allRootIssues, ...previews.flatMap((item) => item.issues)].slice(0, 2000); const validItems = previews.filter((item) => item.status === "valid").length; const invalidItems = previews.filter((item) => item.status === "invalid").length; const duplicateItems = previews.filter((item) => item.status === "duplicate_in_batch" || item.status === "duplicate_in_database").length; const skippedItems = previews.filter((item) => item.status === "skipped").length; const blockingDuplicate = previews.some((item) => item.status === "duplicate_in_batch" || item.status === "duplicate_in_database");
    const confirmToken = randomUUID() + randomUUID(); const now = new Date(); const document: Omit<QuestionImportJobDocument, "_id"> = { subjectId, targetExamSetIds, inputFormat: request.inputFormat, fileName: request.fileName, duplicatePolicy: request.options.duplicatePolicy, status: "ready", totalItems: parsed.items.length, validItems, invalidItems, duplicateItems, skippedItems, importedItems: 0, issues, previewItems: previews, createdQuestionIds: [], confirmTokenHash: tokenHash(confirmToken), createdAt: now, updatedAt: now };
    const result = await this.jobs.create(document); return { jobId: result.insertedId.toHexString(), confirmToken, status: "ready" as const, summary: { totalItems: document.totalItems, validItems, invalidItems, duplicateItems, skippedItems, canConfirm: validItems > 0 && !blockingDuplicate }, items: previews.map(publicItem) };
  }

  async get(id: ObjectId) { const job = await this.jobs.findById(id); if (!job) throw new ApiError("NOT_FOUND", "Import job không tồn tại."); return { jobId: job._id.toHexString(), status: job.status, summary: { totalItems: job.totalItems, validItems: job.validItems, invalidItems: job.invalidItems, duplicateItems: job.duplicateItems, skippedItems: job.skippedItems, importedItems: job.importedItems }, items: job.previewItems.map(publicItem), createdQuestionIds: job.createdQuestionIds.map((item) => item.toHexString()) }; }

  async confirm(id: ObjectId, input: unknown) {
    const { confirmToken } = confirmImportSchema.parse(input); const current = await this.jobs.findById(id); if (!current) throw new ApiError("NOT_FOUND", "Import job không tồn tại."); if (current.status === "completed") return this.get(id); if (current.status === "importing") throw new ApiError("IMPORT_ALREADY_RUNNING", "Import job đang được xử lý.", undefined, 409); if (current.status !== "ready") throw new ApiError("IMPORT_NOT_READY", "Import job chưa sẵn sàng để confirm.", undefined, 409); if (tokenHash(confirmToken) !== current.confirmTokenHash) throw new ApiError("IMPORT_CONFIRM_TOKEN_INVALID", "Confirm token không hợp lệ.");
    if (!current.validItems || current.previewItems.some((item) => ["duplicate_in_batch", "duplicate_in_database"].includes(item.status) && current.duplicatePolicy === "reject")) throw new ApiError("IMPORT_NO_VALID_ITEMS", "Import job không có item hợp lệ để import.", undefined, 422);
    const claimed = await this.jobs.claimReady(id, tokenHash(confirmToken)); if (!claimed) throw new ApiError("IMPORT_ALREADY_RUNNING", "Import job đã được request khác claim.", undefined, 409);
    try {
      const imported = current.previewItems.filter((item) => item.status === "valid"); const subject = await (await this.subjects).findOne({ _id: current.subjectId }); const sets = await (await this.examSets).find({ _id: { $in: current.targetExamSetIds } }).toArray(); if (!subject?.isActive || sets.length !== current.targetExamSetIds.length || sets.some((set) => !set.subjectId.equals(current.subjectId) || set.status === "archived")) throw new ApiError("INVALID_RELATION", "Subject hoặc exam set không còn hợp lệ.");
      await runInTransaction(async (session) => { const documents: QuestionDocument[] = imported.map((item) => { const parsed = questionSchema.parse({ ...(item.normalizedQuestion as unknown as Record<string, unknown>), subjectId: current.subjectId.toHexString(), examSetIds: current.targetExamSetIds.map((setId) => setId.toHexString()), contentHash: item.contentHash }); return { ...parsed, _id: new ObjectId(), subjectId: current.subjectId, examSetIds: current.targetExamSetIds, contentHash: item.contentHash!, createdAt: new Date(), updatedAt: new Date() } as QuestionDocument; }); if (documents.length) { await (await this.questions).insertMany(documents, { session }); await (await this.examSets).updateMany({ _id: { $in: current.targetExamSetIds } }, { $inc: { questionCount: documents.length } }, { session }); } await this.jobs.update(id, { $set: { status: "completed", importedItems: documents.length, createdQuestionIds: documents.map((item) => item._id), completedAt: new Date(), confirmedAt: new Date(), updatedAt: new Date() } }, session); });
      return this.get(id);
    } catch (error) { await this.jobs.update(id, { $set: { status: "failed", updatedAt: new Date(), issues: [{ code: "IMPORT_CONFIRM_FAILED", message: error instanceof Error ? error.message : "Import failed.", severity: "error" }] } }); throw error; }
  }

  async cancel(id: ObjectId) { const current = await this.jobs.findById(id); if (!current) throw new ApiError("NOT_FOUND", "Import job không tồn tại."); if (current.status === "cancelled") return this.get(id); if (current.status === "importing" || current.status === "completed") throw new ApiError("CONFLICT", "Không thể cancel import job ở trạng thái hiện tại."); await this.jobs.cancel(id); return this.get(id); }
}

export async function getQuestionImportService() { return new QuestionImportService(new QuestionImportRepository(await getCollection("question_import_jobs"))); }
