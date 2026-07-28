import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(), runInTransaction: async <T>(work: (session: object) => Promise<T>) => work({ id: "test-session" }) }));
import { createAnswerKeySnapshot, createAttemptSnapshot } from "../src/modules/exam-attempts/exam-attempt-snapshot";
import { selectMixedQuestions, shuffle } from "../src/modules/exam-attempts/exam-attempt-selection";
import { scoreAttempt } from "../src/modules/exam-attempts/exam-attempt-scoring";
import { serializeAttempt } from "../src/modules/exam-attempts/exam-attempt-serializer";
import { ExamAttemptService } from "../src/modules/exam-attempts/exam-attempt.service";
import { UserAnswerService } from "../src/modules/user-answers/user-answer.service";
import type { ExamAttemptDocument } from "../src/modules/exam-attempts/exam-attempt.types";

const subjectId = new ObjectId();
const examSetId = new ObjectId();
const questionId = new ObjectId();
const question = {
  _id: questionId, subjectId, examSetIds: [examSetId], type: "multiple_choice" as const,
  content: { original: "Select two", vi: "Chọn hai" },
  options: [
    { id: "A", label: "A", content: { original: "A" }, isCorrect: true },
    { id: "B", label: "B", content: { original: "B" }, isCorrect: true },
    { id: "C", label: "C", content: { original: "C" }, isCorrect: false },
  ], tags: [], status: "published" as const, contentHash: "hash", createdAt: new Date(), updatedAt: new Date(),
};

function makeAttempt(overrides: Partial<ExamAttemptDocument> = {}): ExamAttemptDocument {
  const now = new Date();
  const snapshot = createAttemptSnapshot(question, 0, false);
  return {
    _id: new ObjectId(), userId: new ObjectId(), mode: "exam_set", subjectId, examSetId, sourceExamSetIds: [examSetId], questionIds: [questionId],
    questionSnapshots: [snapshot], answerKeySnapshots: [createAnswerKeySnapshot(question)], durationSeconds: 3600, status: "in_progress",
    startedAt: now, deadlineAt: new Date(now.getTime() + 3600000), lastSavedAt: now, scoreScale: 10,
    settings: { shuffleQuestions: false, shuffleOptions: false, showTranslation: false, scoringMode: "partial" }, createdAt: now, updatedAt: now, ...overrides,
  };
}

describe("Phase 3A selection, snapshots and scoring", () => {
  it("shuffles once with an injectable random source", () => {
    expect(shuffle(["A", "B", "C"], () => 0)).toEqual(["B", "C", "A"]);
  });

  it("deduplicates mixed questions before enforcing question count", async () => {
    const duplicate = { ...question, _id: new ObjectId(), examSetIds: [examSetId, new ObjectId()] };
    const collection = { find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([question, duplicate, question]) }) }) };
    const result = await selectMixedQuestions(collection as never, [examSetId], 2, false);
    expect(result).toHaveLength(2);
    expect(new Set(result.map((item) => item._id.toHexString())).size).toBe(2);
  });

  it("creates a client snapshot without answer correctness and a separate answer key", () => {
    const mutableQuestion = { ...question, content: { ...question.content }, options: question.options.map((option) => ({ ...option, content: { ...option.content } })) };
    const snapshot = createAttemptSnapshot(mutableQuestion, 0, true, () => 0);
    const key = createAnswerKeySnapshot(mutableQuestion);
    mutableQuestion.content.original = "Changed after create";
    mutableQuestion.options[0].content.original = "Changed option";
    expect(JSON.stringify(snapshot)).not.toContain("isCorrect");
    expect(JSON.stringify(snapshot)).not.toContain('"answer"');
    expect(snapshot.content.original).toBe("Select two");
    expect(snapshot.options?.map((option) => option.content.original)).toEqual(["B", "C", "A"]);
    expect(key.correctOptionIds).toEqual(["A", "B"]);
    expect(key.questionId).toEqual(questionId);
  });

  it("grades multiple choice strict and partial without rewarding all options", () => {
    const strict = scoreAttempt(makeAttempt({ settings: { shuffleQuestions: false, shuffleOptions: false, showTranslation: false, scoringMode: "strict" } }), [{ _id: new ObjectId(), attemptId: new ObjectId(), userId: new ObjectId(), questionId, questionType: "multiple_choice", selectedOptionIds: ["A", "B"], answeredAt: new Date(), updatedAt: new Date() }]);
    const partial = scoreAttempt(makeAttempt(), [{ _id: new ObjectId(), attemptId: new ObjectId(), userId: new ObjectId(), questionId, questionType: "multiple_choice", selectedOptionIds: ["A"], answeredAt: new Date(), updatedAt: new Date() }]);
    const all = scoreAttempt(makeAttempt(), [{ _id: new ObjectId(), attemptId: new ObjectId(), userId: new ObjectId(), questionId, questionType: "multiple_choice", selectedOptionIds: ["A", "B", "C"], answeredAt: new Date(), updatedAt: new Date() }]);
    const duplicate = scoreAttempt(makeAttempt(), [{ _id: new ObjectId(), attemptId: new ObjectId(), userId: new ObjectId(), questionId, questionType: "multiple_choice", selectedOptionIds: ["A", "A"], answeredAt: new Date(), updatedAt: new Date() }]);
    expect(strict.score).toBe(10);
    expect(partial.score).toBe(5);
    expect(all.score).toBe(5);
    expect(duplicate.score).toBe(5);
  });

  it("grades true/false groups strictly and partially", () => {
    const statementQuestion = { ...question, type: "true_false_group" as const, options: undefined, statements: [{ id: "S1", content: { original: "One" }, answer: true }, { id: "S2", content: { original: "Two" }, answer: false }] };
    const statementAttempt = makeAttempt({ questionSnapshots: [createAttemptSnapshot(statementQuestion, 0, false)], answerKeySnapshots: [createAnswerKeySnapshot(statementQuestion)] });
    const strict = scoreAttempt({ ...statementAttempt, settings: { ...statementAttempt.settings, scoringMode: "strict" } }, [{ _id: new ObjectId(), attemptId: new ObjectId(), userId: new ObjectId(), questionId, questionType: "true_false_group", statementAnswers: [{ statementId: "S1", answer: true }, { statementId: "S2", answer: true }], answeredAt: new Date(), updatedAt: new Date() }]);
    const partial = scoreAttempt(statementAttempt, [{ _id: new ObjectId(), attemptId: new ObjectId(), userId: new ObjectId(), questionId, questionType: "true_false_group", statementAnswers: [{ statementId: "S1", answer: true }], answeredAt: new Date(), updatedAt: new Date() }]);
    expect(strict.score).toBe(0);
    expect(partial.score).toBe(5);
  });

  it("counts unanswered, incorrect and partially correct questions consistently", () => {
    const result = scoreAttempt(makeAttempt(), []);
    expect(result.unansweredCount).toBe(1);
    expect(result.correctCount + result.incorrectCount + result.partiallyCorrectCount + result.unansweredCount).toBe(1);
  });

  it("does not expose answer keys or grading before submit", () => {
    const attempt = makeAttempt();
    const result = serializeAttempt(attempt, []);
    expect(result).not.toHaveProperty("answerKeySnapshots");
    expect(JSON.stringify(result)).not.toContain("correctOptionIds");
    expect(JSON.stringify(result)).not.toContain("isCorrect");
  });

  it("returns mustSubmit at zero without mutating the attempt on GET", () => {
    const attempt = makeAttempt({ deadlineAt: new Date(Date.now() - 1000) });
    const result = serializeAttempt(attempt, [], new Date());
    expect(result.secondsRemaining).toBe(0);
    expect(result.mustSubmit).toBe(true);
    expect(attempt.status).toBe("in_progress");
  });

  it("rejects creation for an inactive or unknown user", async () => {
    const attempts = { create: vi.fn() };
    const service = new ExamAttemptService(attempts as never, {} as never, { findOne: vi.fn().mockResolvedValue(null) } as never, {} as never, {} as never, {} as never);
    await expect(service.create({ userId: new ObjectId().toHexString(), mode: "exam_set", examSetId: examSetId.toHexString() })).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    expect(attempts.create).not.toHaveBeenCalled();
  });

  it("creates an exam-set attempt from published questions and preserves duration", async () => {
    const attempt = makeAttempt();
    const attempts = { create: vi.fn().mockResolvedValue({ insertedId: attempt._id }), findById: vi.fn().mockResolvedValue(attempt) };
    const answers = { findByAttempt: vi.fn().mockResolvedValue([]) };
    const service = new ExamAttemptService(
      attempts as never, answers as never,
      { findOne: vi.fn().mockResolvedValue({ _id: attempt.userId, isActive: true }) } as never,
      { findOne: vi.fn().mockResolvedValue({ _id: subjectId, isActive: true }) } as never,
      { findOne: vi.fn().mockResolvedValue({ _id: examSetId, subjectId, status: "published", durationMinutes: 30 }), } as never,
      { find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([question]) }) }) } as never,
    );
    await service.create({ userId: attempt.userId.toHexString(), mode: "exam_set", examSetId: examSetId.toHexString() });
    expect(attempts.create).toHaveBeenCalledOnce();
    expect(attempts.create.mock.calls[0][0].durationSeconds).toBe(1800);
    expect(attempts.create.mock.calls[0][0].answerKeySnapshots).toHaveLength(1);
  });

  it("autosaves valid answers and rejects a second user's answer", async () => {
    const attempt = makeAttempt();
    const upsert = vi.fn().mockResolvedValue({ questionId, selectedOptionIds: ["A"], isFlagged: false });
    const attempts = { findById: vi.fn().mockResolvedValue(attempt), updateOwned: vi.fn() };
    const service = new ExamAttemptService(attempts as never, { upsert } as never, { findOne: vi.fn().mockResolvedValue({ _id: attempt.userId, isActive: true }) } as never, {} as never, {} as never, {} as never);
    await expect(service.saveAnswer(attempt._id, { userId: attempt.userId.toHexString(), questionId: questionId.toHexString(), selectedOptionIds: ["A"] })).resolves.toMatchObject({ saved: true });
    await expect(service.saveAnswer(attempt._id, { userId: new ObjectId().toHexString(), questionId: questionId.toHexString(), selectedOptionIds: ["A"] })).rejects.toMatchObject({ code: "ATTEMPT_FORBIDDEN" });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("clears answers and preserves them for flag-only updates", async () => {
    const attempt = makeAttempt();
    const upsert = vi.fn().mockResolvedValue({});
    const service = new UserAnswerService({ upsert } as never);
    await service.save(attempt, { userId: attempt.userId.toHexString(), questionId: questionId.toHexString(), selectedOptionIds: ["A"], isFlagged: true });
    await service.save(attempt, { userId: attempt.userId.toHexString(), questionId: questionId.toHexString(), selectedOptionIds: [] });
    await service.save(attempt, { userId: attempt.userId.toHexString(), questionId: questionId.toHexString(), isFlagged: false });
    expect(upsert.mock.calls[1][4].$set.selectedOptionIds).toEqual([]);
    expect(upsert.mock.calls[2][4].$set).not.toHaveProperty("selectedOptionIds");
    expect(upsert.mock.calls[2][4].$set.isFlagged).toBe(false);
  });

  it("claims submit once and scores from the answer-key snapshot", async () => {
    const attempt = makeAttempt();
    const answer = { _id: new ObjectId(), attemptId: attempt._id, userId: attempt.userId, questionId, questionType: "multiple_choice" as const, selectedOptionIds: ["A", "B"], answeredAt: new Date(), updatedAt: new Date() };
    const claim = vi.fn().mockResolvedValue({ ...attempt, status: "submitting" as const });
    const update = vi.fn().mockImplementation((_id, patch) => ({ ...attempt, ...patch.$set }));
    const findById = vi.fn().mockResolvedValue(attempt);
    const answers = { findByAttempt: vi.fn().mockResolvedValue([answer]), updateForAttempt: vi.fn() };
    const service = new ExamAttemptService({ findById, claimForSubmit: claim, update } as never, answers as never, { findOne: vi.fn().mockResolvedValue({ _id: attempt.userId, isActive: true }) } as never, {} as never, {} as never, {} as never);
    const result = await service.submit(attempt._id, { userId: attempt.userId.toHexString() });
    expect(claim).toHaveBeenCalledOnce();
    expect(answers.updateForAttempt).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][1].$set.submitReason).toBe("manual");
    expect(result).toMatchObject({ status: "submitted", score: 10 });
  });

  it("submits after the deadline as expired with timeout reason", async () => {
    const attempt = makeAttempt({ deadlineAt: new Date(Date.now() - 1000) });
    const update = vi.fn().mockImplementation((_id, patch) => ({ ...attempt, ...patch.$set }));
    const service = new ExamAttemptService(
      { findById: vi.fn().mockResolvedValue(attempt), claimForSubmit: vi.fn().mockResolvedValue({ ...attempt, status: "submitting" as const }), update } as never,
      { findByAttempt: vi.fn().mockResolvedValue([]), updateForAttempt: vi.fn() } as never,
      { findOne: vi.fn().mockResolvedValue({ _id: attempt.userId, isActive: true }) } as never, {} as never, {} as never, {} as never,
    );
    const result = await service.submit(attempt._id, { userId: attempt.userId.toHexString() });
    expect(update.mock.calls[0][1].$set).toMatchObject({ status: "expired", submitReason: "timeout" });
    expect(result).toMatchObject({ status: "expired", score: 0 });
  });

  it("rolls back a claimed submit when grading fails", async () => {
    const attempt = makeAttempt();
    const rollback = vi.fn();
    const answers = { findByAttempt: vi.fn().mockResolvedValue([{ _id: new ObjectId(), attemptId: attempt._id, userId: attempt.userId, questionId, questionType: "multiple_choice" as const, selectedOptionIds: ["A"], answeredAt: new Date(), updatedAt: new Date() }]), updateForAttempt: vi.fn().mockRejectedValue(new Error("grading failed")) };
    const service = new ExamAttemptService({ findById: vi.fn().mockResolvedValue(attempt), claimForSubmit: vi.fn().mockResolvedValue({ ...attempt, status: "submitting" as const }), updateOwned: rollback } as never, answers as never, { findOne: vi.fn().mockResolvedValue({ _id: attempt.userId, isActive: true }) } as never, {} as never, {} as never, {} as never);
    await expect(service.submit(attempt._id, { userId: attempt.userId.toHexString() })).rejects.toThrow("grading failed");
    expect(rollback).toHaveBeenCalledWith(attempt._id, attempt.userId, expect.objectContaining({ $set: expect.objectContaining({ status: "in_progress" }) }));
  });
});
