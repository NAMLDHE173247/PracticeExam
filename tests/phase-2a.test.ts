import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(),
  runInTransaction: async <T>(work: (session: object) => Promise<T>) => work({}),
}));

import { serializeValue } from "../src/lib/api/serialize";
import { createExamSetSchema } from "../src/modules/exam-sets/exam-set.api.schema";
import { ExamSetService } from "../src/modules/exam-sets/exam-set.service";
import type { ExamSetRepository } from "../src/modules/exam-sets/exam-set.repository";
import { createQuestionContentHash } from "../src/modules/questions/question-hash";
import { QuestionService } from "../src/modules/questions/question.service";
import type { QuestionRepository } from "../src/modules/questions/question.repository";
import { createSubjectSchema } from "../src/modules/subjects/subject.api.schema";
import { SubjectService } from "../src/modules/subjects/subject.service";
import type { SubjectRepository } from "../src/modules/subjects/subject.repository";

const subjectId = new ObjectId();
const examSetA = new ObjectId();
const examSetB = new ObjectId();
const questionId = new ObjectId();
const text = { original: "  Which   answer?\r\n  ", vi: "Câu hỏi" };
const options = [
  { id: "A", label: "A", content: { original: " First answer ", vi: "Đáp án một" }, isCorrect: true },
  { id: "B", label: "B", content: { original: "Second answer", vi: "Đáp án hai" }, isCorrect: false },
];
const question = { _id: questionId, subjectId, examSetIds: [examSetA], type: "single_choice" as const, content: text, options, tags: ["old"], status: "draft" as const, contentHash: "old-hash", createdAt: new Date(), updatedAt: new Date() };
const collection = (findOne: unknown, sets: unknown[] = []) => ({ findOne: vi.fn().mockResolvedValue(findOne), find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(sets) }), countDocuments: vi.fn().mockResolvedValue(sets.length), updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }) });

describe("Phase 2A backend primitives", () => {
  it("normalizes subject create input and defaults active state in the service", async () => {
    const created = { _id: new ObjectId(), code: "ENW492C", name: "English", isActive: true, createdAt: new Date(), updatedAt: new Date() };
    const repository = { findByCode: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ insertedId: created._id }), findById: vi.fn().mockResolvedValue(created) } as unknown as SubjectRepository;
    const service = new SubjectService(repository, Promise.resolve({ countDocuments: vi.fn().mockResolvedValue(0) } as never));
    await service.create({ code: " enw492c ", name: " English " });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ code: "ENW492C", name: "English", isActive: true }));
    expect(createSubjectSchema.safeParse({ code: "A", name: "B", isActive: false }).success).toBe(false);
  });

  it("validates exam-set duration and score boundaries", () => {
    const id = new ObjectId().toHexString();
    expect(createExamSetSchema.safeParse({ subjectId: id, title: "Set", defaultDurationMinutes: 60, passingScore: 7 }).success).toBe(true);
    expect(createExamSetSchema.safeParse({ subjectId: id, title: "Set", defaultDurationMinutes: 601 }).success).toBe(false);
    expect(createExamSetSchema.safeParse({ subjectId: id, title: "Set", passingScore: 11 }).success).toBe(false);
  });

  it("serializes ObjectId and Date", () => {
    const id = new ObjectId(); const date = new Date("2026-01-01T00:00:00.000Z");
    expect(serializeValue({ id, date })).toEqual({ id: id.toHexString(), date: date.toISOString() });
  });

  it("hashes only normalized question content, not relations or metadata", () => {
    const first = { type: "single_choice" as const, content: text, options };
    expect(createQuestionContentHash(first)).toBe(createQuestionContentHash({ ...first, content: { original: "which answer?", vi: "Khác" }, options: options.map((item) => ({ ...item, content: { ...item.content, vi: "Bản dịch khác" } })) }));
    expect(createQuestionContentHash(first)).not.toBe(createQuestionContentHash({ ...first, content: { original: "Different question" } }));
    expect(createQuestionContentHash(first)).not.toBe(createQuestionContentHash({ ...first, options: options.map((item) => ({ ...item, isCorrect: !item.isCorrect })) }));
  });

  it("creates a question without a transaction when no exam set is supplied", async () => {
    const repository = { findByHash: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ insertedId: questionId }), findById: vi.fn().mockResolvedValue({ ...question, examSetIds: [] }) } as unknown as QuestionRepository;
    const subjects = Promise.resolve(collection({ _id: subjectId, isActive: true }));
    const examSets = Promise.resolve(collection(null));
    const service = new QuestionService(repository, subjects as never, examSets as never);
    const result = await service.create({ subjectId: subjectId.toHexString(), examSetIds: [], type: "single_choice", content: text, options, tags: ["tag"], status: "draft" });
    expect(result).toBeTruthy();
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ examSetIds: [], contentHash: createQuestionContentHash({ type: "single_choice", content: text, options }) }));
  });

  it("uses the same content hash for questions with different relations or metadata", () => {
    const base = { type: "single_choice" as const, content: text, options };
    expect(createQuestionContentHash(base)).toBe(createQuestionContentHash(base));
    expect(createQuestionContentHash(base)).not.toBe(createQuestionContentHash({ ...base, content: { original: "changed" } }));
  });

  it("attach is idempotent and updates count only on the first relation", async () => {
    const addExamSet = vi.fn().mockResolvedValueOnce({ modifiedCount: 1 }).mockResolvedValueOnce({ modifiedCount: 0 });
    const repository = { findById: vi.fn().mockResolvedValue(question), addExamSet } as unknown as QuestionRepository;
    const examCollection = collection(null, [{ _id: examSetB, subjectId, status: "draft" }]);
    const service = new QuestionService(repository, Promise.resolve(collection({ _id: subjectId, isActive: true })) as never, Promise.resolve(examCollection) as never);
    await service.attach(examSetB, questionId); await service.attach(examSetB, questionId);
    expect(addExamSet).toHaveBeenCalledTimes(2); expect(examCollection.updateMany).toHaveBeenCalledTimes(1);
  });

  it("remove is idempotent and cannot decrement twice", async () => {
    const removeExamSet = vi.fn().mockResolvedValueOnce({ modifiedCount: 1 }).mockResolvedValueOnce({ modifiedCount: 0 });
    const repository = { findById: vi.fn().mockResolvedValue(question), removeExamSet } as unknown as QuestionRepository;
    const examCollection = collection(null, []);
    const service = new QuestionService(repository, Promise.resolve(collection({ _id: subjectId, isActive: true })) as never, Promise.resolve(examCollection) as never);
    await service.detach(examSetA, questionId); await service.detach(examSetA, questionId);
    expect(removeExamSet).toHaveBeenCalledTimes(2); expect(examCollection.updateMany).toHaveBeenCalledTimes(1);
  });

  it("rejects attach across subjects and to archived exam sets", async () => {
    const repository = { findById: vi.fn().mockResolvedValue(question), addExamSet: vi.fn() } as unknown as QuestionRepository;
    const subjectCollection = collection({ _id: subjectId, isActive: true });
    const foreignSet = collection(null, [{ _id: examSetB, subjectId: new ObjectId(), status: "draft" }]);
    const service = new QuestionService(repository, Promise.resolve(subjectCollection) as never, Promise.resolve(foreignSet) as never);
    await expect(service.attach(examSetB, questionId)).rejects.toMatchObject({ code: "INVALID_RELATION" });
    const archivedSet = collection(null, [{ _id: examSetB, subjectId, status: "archived" }]);
    const archivedService = new QuestionService(repository, Promise.resolve(subjectCollection) as never, Promise.resolve(archivedSet) as never);
    await expect(archivedService.attach(examSetB, questionId)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("archives a question without decrementing questionCount", async () => {
    const repository = { findById: vi.fn().mockResolvedValue(question), update: vi.fn().mockResolvedValue(question) } as unknown as QuestionRepository;
    const examCollection = collection(null, []);
    const service = new QuestionService(repository, Promise.resolve(collection({ _id: subjectId, isActive: true })) as never, Promise.resolve(examCollection) as never);
    await service.remove(questionId);
    expect(examCollection.updateMany).not.toHaveBeenCalled();
  });

  it("does not publish an empty exam set or change subject after questions exist", async () => {
    const repository = { findById: vi.fn().mockResolvedValue({ _id: examSetA, subjectId, questionCount: 0, status: "draft" }) } as unknown as ExamSetRepository;
    const questionCollection = collection(null, [{}]); questionCollection.countDocuments.mockResolvedValueOnce(0).mockResolvedValue(1);
    const service = new ExamSetService(repository, Promise.resolve(collection({ _id: subjectId, isActive: true })) as never, Promise.resolve(questionCollection) as never);
    await expect(service.update(examSetA, { status: "published" })).rejects.toMatchObject({ code: "CONFLICT" });
    (repository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: examSetA, subjectId, questionCount: 1, status: "draft" });
    await expect(service.update(examSetA, { subjectId: new ObjectId().toHexString() })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
