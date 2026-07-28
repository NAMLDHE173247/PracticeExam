import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { ApiError, errorResponse } from "../src/lib/api/response";
import { createExamAttemptSchema } from "../src/modules/exam-attempts/exam-attempt.schema";
import { ExamAttemptRepository } from "../src/modules/exam-attempts/exam-attempt.repository";
import { updateUserAnswerSchema } from "../src/modules/user-answers/user-answer.schema";

describe("Phase 3A review hardening", () => {
  it.each(["Transaction numbers are only allowed on a replica set member", "transactions support requires a replica set"]) ("maps unsupported transaction error to 503: %s", async (message) => {
    const response = errorResponse(new Error(message));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "TRANSACTION_REQUIRED" } });
  });

  it("maps an ordinary error to 500 and ownership errors to 403", async () => {
    expect(errorResponse(new Error("ordinary failure")).status).toBe(500);
    expect(errorResponse(new ApiError("ATTEMPT_FORBIDDEN", "Forbidden")).status).toBe(403);
  });

  it("enforces mixed duration boundaries", () => {
    const base = { mode: "mixed" as const, userId: new ObjectId().toHexString(), subjectId: new ObjectId().toHexString(), sourceExamSetIds: [new ObjectId().toHexString()], questionCount: 1 };
    expect(createExamAttemptSchema.safeParse({ ...base, durationMinutes: 1 }).success).toBe(true);
    expect(createExamAttemptSchema.safeParse({ ...base, durationMinutes: 600 }).success).toBe(true);
    expect(createExamAttemptSchema.safeParse({ ...base, durationMinutes: 0 }).success).toBe(false);
    expect(createExamAttemptSchema.safeParse({ ...base, durationMinutes: 601 }).success).toBe(false);
  });

  it("rejects two answer payloads before persistence", () => {
    const result = updateUserAnswerSchema.safeParse({ userId: new ObjectId().toHexString(), questionId: new ObjectId().toHexString(), selectedOptionIds: ["A"], statementAnswers: [{ statementId: "S1", answer: true }] });
    expect(result.success).toBe(false);
  });

  it("uses submitting-only filters for rollback and completion", async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue(null);
    const repository = new ExamAttemptRepository({ findOneAndUpdate } as never);
    const id = new ObjectId();
    const userId = new ObjectId();
    await repository.rollbackSubmitClaim(id, userId);
    expect(findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: id, userId, status: "submitting" });
    await repository.completeSubmittingAttempt(id, userId, { $set: { status: "submitted" } });
    expect(findOneAndUpdate.mock.calls[1][0]).toMatchObject({ _id: id, userId, status: "submitting" });
  });
});
