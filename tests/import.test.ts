import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
const transactionSession = vi.hoisted(() => ({ id: "session" }));
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(), runInTransaction: async <T>(work: (session: object) => Promise<T>) => work(transactionSession) }));
import { parseJsonImport } from "../src/modules/imports/import-parser-json";
import { parseStructuredText } from "../src/modules/imports/import-parser-structured-text";
import { validateImportItems } from "../src/modules/imports/import-validator";
import { QuestionImportService } from "../src/modules/imports/import.service";
import { createQuestionContentHash } from "../src/modules/questions/question-hash";
import { normalizeImportQuestion } from "../src/modules/imports/import-normalizer";
import { errorResponse } from "../src/lib/api/response";
import type { QuestionImportRepository } from "../src/modules/imports/import.repository";

const subjectId = new ObjectId().toHexString();
const question = { type: "single_choice", content: "Question", options: [{ label: "A", content: "One", isCorrect: true }, { label: "B", content: "Two", isCorrect: false }] };
const normalizedQuestion = { type: "single_choice" as const, content: { original: "Question" }, options: [{ id: "A", label: "A", content: { original: "One" }, isCorrect: true }, { id: "B", label: "B", content: { original: "Two" }, isCorrect: false }], tags: [], status: "draft" as const };

describe("Phase 2B import parsers", () => {
  it("parses a JSON array and normalizes string content", () => {
    const result = parseJsonImport(JSON.stringify([question]));
    expect(result.items[0].normalizedQuestion?.content).toEqual({ original: "Question" });
    expect(result.items[0].normalizedQuestion?.options?.[0]).toMatchObject({ id: "A", content: { original: "One" } });
    expect(result.items[0].normalizedQuestion?.options?.[0].isCorrect).toBe(true);
  });

  it("parses a questions wrapper and rejects malformed JSON/root", () => {
    expect(parseJsonImport(JSON.stringify({ questions: [question] })).items).toHaveLength(1);
    expect(parseJsonImport("{").rootIssue?.code).toBe("INVALID_JSON");
    expect(parseJsonImport(JSON.stringify({ data: [] })).rootIssue?.code).toBe("INVALID_ROOT_FORMAT");
  });

  it("does not infer missing isCorrect", () => {
    const result = parseJsonImport(JSON.stringify([{ ...question, options: [{ label: "A", content: "One" }, { label: "B", content: "Two" }] }]));
    expect((result.items[0].normalizedQuestion as { options?: Array<Record<string, unknown>> } | undefined)?.options?.[0]).not.toHaveProperty("isCorrect");
  });

  it("parses structured single, multiple and true/false blocks", () => {
    const content = `[QUESTION]\nTYPE: single_choice\nCONTENT: One?\nA: A\nB: B\nANSWER: B\n[/QUESTION]\n[QUESTION]\nTYPE: multiple_choice\nCONTENT: Many?\nA: A\nB: B\nC: C\nANSWER: B,C\n[/QUESTION]\n[QUESTION]\nTYPE: true_false_group\nCONTENT: Decide.\n1: First | TRUE\n2: Second | SAI\n[/QUESTION]`;
    const result = parseStructuredText(content);
    expect(result.rootIssues).toHaveLength(0); expect(result.items).toHaveLength(3); expect((result.items[1].normalizedQuestion as { options?: Array<{ isCorrect?: boolean }> } | undefined)?.options?.filter((item) => item.isCorrect)).toHaveLength(2); expect((result.items[2].normalizedQuestion as { statements?: Array<{ answer: boolean }> } | undefined)?.statements?.[1].answer).toBe(false);
  });

  it("supports CRLF, case-insensitive fields and reports block errors", () => {
    const result = parseStructuredText("[question]\r\ntype: single_choice\r\ncontent: Test\r\nA: One\r\nB: Two\r\nanswer: A\r\n[/question]");
    expect(result.items).toHaveLength(1); expect(result.items[0].normalizedQuestion?.type).toBe("single_choice");
    expect(parseStructuredText("[QUESTION]\nTYPE: single_choice").rootIssues[0].code).toBe("MISSING_BLOCK_END");
    expect(parseStructuredText("outside\n").rootIssues[0].code).toBe("CONTENT_OUTSIDE_BLOCK");
  });

  it("reports unrecognized structured lines with a bounded line snippet", () => {
    const result = parseStructuredText(`[QUESTION]\nTYPE: single_choice\nCONTNT: What is HTTP?\nANSWER B\n${"x".repeat(250)}\nA: One\nB: Two\nANSWER: A\n[/QUESTION]`);
    const issues = result.items[0].parseIssues.filter((issue) => issue.code === "UNRECOGNIZED_LINE");
    expect(issues).toHaveLength(3); expect(issues[0].field).toBe("line.3"); expect(issues[0].message.length).toBeLessThan(240); expect(issues[1].field).toBe("line.4"); expect(issues[2].field).toBe("line.5");
  });

  it("applies every translation default and lets an item override it", () => {
    const defaults = ["not_required", "pending", "translated", "reviewed", "failed"] as const;
    for (const defaultTranslationStatus of defaults) expect(normalizeImportQuestion(normalizedQuestion, subjectId, [], { defaultStatus: "draft", defaultTranslationStatus }).translationStatus).toBe(defaultTranslationStatus);
    expect(normalizeImportQuestion({ ...normalizedQuestion, translationStatus: "reviewed" }, subjectId, [], { defaultStatus: "draft", defaultTranslationStatus: "pending" }).translationStatus).toBe("reviewed");
  });

  it("validates items, detects batch duplicate and honors skip policy", async () => {
    const parsed = parseJsonImport(JSON.stringify([question, question])); const collection = { find: vi.fn().mockReturnValue({ project: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }) };
    const result = await validateImportItems(parsed.items, subjectId, [], { defaultStatus: "draft" }, "skip", collection as never);
    expect(result[0].status).toBe("valid"); expect(result[1].status).toBe("skipped"); expect(result[1].issues[0].code).toBe("DUPLICATE_WITHIN_IMPORT");
  });

  it("detects database duplicate and allows it only with allow policy", async () => {
    const parsed = parseJsonImport(JSON.stringify([question])); const existing = { _id: new ObjectId(), contentHash: createQuestionContentHash({ type: "single_choice", content: { original: "Question" }, options: [{ id: "A", label: "A", content: { original: "One" }, isCorrect: true }, { id: "B", label: "B", content: { original: "Two" }, isCorrect: false }] }) }; const collection = { find: vi.fn().mockReturnValue({ project: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([existing]) }) }) };
    const rejected = await validateImportItems(parsed.items, subjectId, [], { defaultStatus: "draft" }, "reject", collection as never); expect(rejected[0].status).toBe("duplicate_in_database");
    const allowed = await validateImportItems(parsed.items, subjectId, [], { defaultStatus: "draft" }, "allow", collection as never); expect(allowed[0].status).toBe("valid"); expect(allowed[0].duplicateQuestionId).toEqual(existing._id);
  });

  it("creates preview without inserting questions or changing counts", async () => {
    const jobs = { create: vi.fn().mockResolvedValue({ insertedId: new ObjectId() }) } as unknown as QuestionImportRepository;
    const subjectCollection = { findOne: vi.fn().mockResolvedValue({ _id: new ObjectId(subjectId), isActive: true }) };
    const examCollection = { find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) };
    const questionCollection = { find: vi.fn().mockReturnValue({ project: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }), insertMany: vi.fn(), updateMany: vi.fn() };
    const service = new QuestionImportService(jobs, Promise.resolve(subjectCollection) as never, Promise.resolve(examCollection) as never, Promise.resolve(questionCollection) as never);
    const result = await service.validate({ subjectId, targetExamSetIds: [], inputFormat: "json", content: JSON.stringify([question]) });
    expect(result.summary.validItems).toBe(1); expect(jobs.create).toHaveBeenCalledOnce(); expect(questionCollection.insertMany).not.toHaveBeenCalled(); expect(questionCollection.updateMany).not.toHaveBeenCalled();
  });

  it("confirms once and returns the completed result on retry", async () => {
    const token = "1234567890123456"; const hash = createHash("sha256").update(token).digest("hex"); const jobId = new ObjectId(); const subject = new ObjectId(subjectId); const examSet = new ObjectId();
    const job = { _id: jobId, subjectId: subject, targetExamSetIds: [examSet], inputFormat: "json" as const, duplicatePolicy: "reject" as const, status: "ready" as const, totalItems: 1, validItems: 1, invalidItems: 0, duplicateItems: 0, skippedItems: 0, importedItems: 0, issues: [], previewItems: [{ itemIndex: 0, status: "valid" as const, contentHash: "hash", normalizedQuestion, issues: [] }], createdQuestionIds: [], confirmTokenHash: hash, createdAt: new Date(), updatedAt: new Date() };
    const completedJob = { ...job, status: "completed" as const, importedItems: 1, createdQuestionIds: [new ObjectId()] }; const findById = vi.fn().mockResolvedValueOnce(job).mockResolvedValue(completedJob); const claimReady = vi.fn().mockResolvedValue(job); const update = vi.fn().mockResolvedValue(job); const jobs = { findById, claimReady, update } as unknown as QuestionImportRepository;
    const subjects = { findOne: vi.fn().mockResolvedValue({ _id: subject, isActive: true }) }; const sets = { find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ _id: examSet, subjectId: subject, status: "draft" }]) }), updateMany: vi.fn() }; const questions = { insertMany: vi.fn(), updateMany: vi.fn() };
    const service = new QuestionImportService(jobs, Promise.resolve(subjects) as never, Promise.resolve(sets) as never, Promise.resolve(questions) as never);
    await service.confirm(jobId, { confirmToken: token }); await service.confirm(jobId, { confirmToken: token });
    expect(claimReady).toHaveBeenCalledOnce(); expect(questions.insertMany).toHaveBeenCalledOnce(); expect(sets.updateMany).toHaveBeenCalledOnce(); expect(questions.insertMany.mock.calls[0][0][0]).not.toHaveProperty("allowDuplicate");
  });

  it("allows only one concurrent confirm to claim a ready job", async () => {
    const token = "1234567890123456"; const hash = createHash("sha256").update(token).digest("hex"); const jobId = new ObjectId(); const subject = new ObjectId(subjectId); const examSet = new ObjectId();
    const job = { _id: jobId, subjectId: subject, targetExamSetIds: [examSet], inputFormat: "json" as const, duplicatePolicy: "allow" as const, status: "ready" as const, totalItems: 1, validItems: 1, invalidItems: 0, duplicateItems: 0, skippedItems: 0, importedItems: 0, issues: [], previewItems: [{ itemIndex: 0, status: "valid" as const, contentHash: "hash", normalizedQuestion, issues: [] }], createdQuestionIds: [], confirmTokenHash: hash, createdAt: new Date(), updatedAt: new Date() };
    const claimed = { ...job, status: "importing" as const }; const completed = { ...job, status: "completed" as const, importedItems: 1, createdQuestionIds: [new ObjectId()] };
    const jobs = { findById: vi.fn().mockResolvedValueOnce(job).mockResolvedValueOnce(job).mockResolvedValue(completed), claimReady: vi.fn().mockResolvedValueOnce(claimed).mockResolvedValueOnce(null), update: vi.fn().mockResolvedValue(completed) } as unknown as QuestionImportRepository;
    const subjects = { findOne: vi.fn().mockResolvedValue({ _id: subject, isActive: true }) }; const sets = { find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ _id: examSet, subjectId: subject, status: "draft" }]) }), updateMany: vi.fn() }; const questions = { insertMany: vi.fn(), updateMany: vi.fn() };
    const service = new QuestionImportService(jobs, Promise.resolve(subjects) as never, Promise.resolve(sets) as never, Promise.resolve(questions) as never);
    const results = await Promise.allSettled([service.confirm(jobId, { confirmToken: token }), service.confirm(jobId, { confirmToken: token })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1); expect(results.filter((result) => result.status === "rejected")).toHaveLength(1); expect(jobs.claimReady).toHaveBeenCalledTimes(2); expect(questions.insertMany).toHaveBeenCalledOnce();
  });

  it("uses one session for insert, count update and job completion", async () => {
    const token = "1234567890123456"; const hash = createHash("sha256").update(token).digest("hex"); const jobId = new ObjectId(); const subject = new ObjectId(subjectId); const examSet = new ObjectId();
    const job = { _id: jobId, subjectId: subject, targetExamSetIds: [examSet], inputFormat: "json" as const, duplicatePolicy: "reject" as const, status: "ready" as const, totalItems: 1, validItems: 1, invalidItems: 0, duplicateItems: 0, skippedItems: 0, importedItems: 0, issues: [], previewItems: [{ itemIndex: 0, status: "valid" as const, contentHash: "hash", normalizedQuestion, issues: [] }], createdQuestionIds: [], confirmTokenHash: hash, createdAt: new Date(), updatedAt: new Date() };
    const jobs = { findById: vi.fn().mockResolvedValue(job), claimReady: vi.fn().mockResolvedValue({ ...job, status: "importing" as const }), update: vi.fn().mockResolvedValue({ ...job, status: "completed" as const }) } as unknown as QuestionImportRepository;
    const subjects = { findOne: vi.fn().mockResolvedValue({ _id: subject, isActive: true }) }; const sets = { find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ _id: examSet, subjectId: subject, status: "draft" }]) }), updateMany: vi.fn() }; const questions = { insertMany: vi.fn(), updateMany: vi.fn() };
    const service = new QuestionImportService(jobs, Promise.resolve(subjects) as never, Promise.resolve(sets) as never, Promise.resolve(questions) as never);
    await service.confirm(jobId, { confirmToken: token });
    expect(questions.insertMany.mock.calls[0][1].session).toBe(transactionSession); expect(sets.updateMany.mock.calls[0][2].session).toBe(transactionSession); expect((jobs.update as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2]).toBe(transactionSession);
  });

  it("marks the job failed without applying later writes when the transaction fails", async () => {
    const token = "1234567890123456"; const hash = createHash("sha256").update(token).digest("hex"); const jobId = new ObjectId(); const subject = new ObjectId(subjectId); const examSet = new ObjectId();
    const job = { _id: jobId, subjectId: subject, targetExamSetIds: [examSet], inputFormat: "json" as const, duplicatePolicy: "reject" as const, status: "ready" as const, totalItems: 1, validItems: 1, invalidItems: 0, duplicateItems: 0, skippedItems: 0, importedItems: 0, issues: [], previewItems: [{ itemIndex: 0, status: "valid" as const, contentHash: "hash", normalizedQuestion, issues: [] }], createdQuestionIds: [], confirmTokenHash: hash, createdAt: new Date(), updatedAt: new Date() };
    const jobs = { findById: vi.fn().mockResolvedValue(job), claimReady: vi.fn().mockResolvedValue({ ...job, status: "importing" as const }), update: vi.fn().mockResolvedValue(job) } as unknown as QuestionImportRepository;
    const subjects = { findOne: vi.fn().mockResolvedValue({ _id: subject, isActive: true }) }; const sets = { find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ _id: examSet, subjectId: subject, status: "draft" }]) }), updateMany: vi.fn() }; const questions = { insertMany: vi.fn().mockRejectedValue(new Error("transaction failed")), updateMany: vi.fn() };
    const service = new QuestionImportService(jobs, Promise.resolve(subjects) as never, Promise.resolve(sets) as never, Promise.resolve(questions) as never);
    await expect(service.confirm(jobId, { confirmToken: token })).rejects.toThrow("transaction failed"); expect(sets.updateMany).not.toHaveBeenCalled(); expect(jobs.update).toHaveBeenCalledOnce(); expect((jobs.update as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].$set.status).toBe("failed");
  });

  it("does not expose token hashes or raw import content in a job response", async () => {
    const job = { _id: new ObjectId(), status: "ready" as const, totalItems: 0, validItems: 0, invalidItems: 0, duplicateItems: 0, skippedItems: 0, importedItems: 0, previewItems: [], createdQuestionIds: [], confirmTokenHash: "secret-hash", raw: "secret content" };
    const jobs = { findById: vi.fn().mockResolvedValue(job) } as unknown as QuestionImportRepository; const service = new QuestionImportService(jobs);
    const result = await service.get(job._id);
    expect(result).not.toHaveProperty("confirmToken"); expect(result).not.toHaveProperty("confirmTokenHash"); expect(result).not.toHaveProperty("raw");
  });

  it("cancels ready jobs idempotently and rejects importing or completed jobs", async () => {
    const ready = { _id: new ObjectId(), status: "ready" as const, totalItems: 0, validItems: 0, invalidItems: 0, duplicateItems: 0, skippedItems: 0, importedItems: 0, previewItems: [], createdQuestionIds: [] }; const cancelled = { ...ready, status: "cancelled" as const }; const importing = { ...ready, status: "importing" as const }; const completed = { ...ready, status: "completed" as const };
    const jobs = { findById: vi.fn().mockResolvedValueOnce(ready).mockResolvedValueOnce(cancelled).mockResolvedValueOnce(cancelled).mockResolvedValueOnce(cancelled).mockResolvedValueOnce(importing).mockResolvedValueOnce(completed), cancel: vi.fn().mockResolvedValue(cancelled) } as unknown as QuestionImportRepository; const service = new QuestionImportService(jobs);
    await service.cancel(ready._id); await service.cancel(ready._id); await expect(service.cancel(ready._id)).rejects.toMatchObject({ code: "CONFLICT" }); await expect(service.cancel(ready._id)).rejects.toMatchObject({ code: "CONFLICT" }); expect(jobs.cancel).toHaveBeenCalledOnce();
  });

  it("rejects oversized, empty and all-invalid imports before creating a ready job", async () => {
    const jobs = { create: vi.fn() } as unknown as QuestionImportRepository; const subjects = { findOne: vi.fn().mockResolvedValue({ _id: new ObjectId(subjectId), isActive: true }) }; const sets = { find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }; const questions = { find: vi.fn() };
    const service = new QuestionImportService(jobs, Promise.resolve(subjects) as never, Promise.resolve(sets) as never, Promise.resolve(questions) as never);
    const many = JSON.stringify(Array.from({ length: 501 }, () => question));
    await expect(service.validate({ subjectId, targetExamSetIds: [], inputFormat: "json", content: many })).rejects.toMatchObject({ code: "IMPORT_TOO_LARGE" });
    await expect(service.validate({ subjectId, targetExamSetIds: [], inputFormat: "json", content: "[]" })).rejects.toMatchObject({ code: "IMPORT_NO_VALID_ITEMS" });
    await expect(service.validate({ subjectId, targetExamSetIds: [], inputFormat: "json", content: JSON.stringify([{}]) })).rejects.toMatchObject({ code: "IMPORT_NO_VALID_ITEMS" });
    expect(jobs.create).not.toHaveBeenCalled();
  });

  it("maps standalone transaction errors to HTTP 503", async () => {
    const response = errorResponse(new Error("Transaction numbers are only allowed on a replica set member or mongos"));
    expect(response.status).toBe(503); expect((await response.json()).error.code).toBe("TRANSACTION_REQUIRED");
    expect(errorResponse(new Error("ordinary failure")).status).toBe(500);
  });
});
