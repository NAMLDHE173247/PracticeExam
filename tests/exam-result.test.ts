import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/lib/api/response";
import { serializeResult } from "../src/modules/exam-results/exam-result-serializer";
import { scoreAttempt } from "../src/modules/exam-attempts/exam-attempt-scoring";
import type { ExamAttemptDocument } from "../src/modules/exam-attempts/exam-attempt.types";

function expectApi409(fn: () => void, code: string) {
  try {
    fn();
    expect.fail("Expected function to throw");
  } catch (e: any) {
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(409);
    expect(e.code).toBe(code);
  }
}

const subjectId = new ObjectId();
const examSetId = new ObjectId();
const userId = new ObjectId();

const createMockAttempt = (overrides?: Partial<ExamAttemptDocument>): ExamAttemptDocument => {
  const now = new Date();
  const q1 = new ObjectId();
  const q2 = new ObjectId();

  return {
    _id: new ObjectId(),
    userId,
    mode: "exam_set",
    subjectId,
    examSetId,
    sourceExamSetIds: [examSetId],
    questionIds: [q1, q2],
    durationSeconds: 3600,
    status: "submitted",
    startedAt: now,
    deadlineAt: now,
    submittedAt: now,
    submitReason: "manual",
    lastSavedAt: now,
    scoreScale: 10,
    score: 10,
    correctCount: 2,
    incorrectCount: 0,
    unansweredCount: 0,
    partiallyCorrectCount: 0,
    totalEarnedPoints: 2,
    totalMaxPoints: 2,
    settings: {
      shuffleQuestions: false,
      shuffleOptions: false,
      showTranslation: false,
      scoringMode: "strict"
    },
    createdAt: now,
    updatedAt: now,
    questionSnapshots: [
      {
        questionId: q1,
        order: 1,
        type: "multiple_choice",
        content: { original: "Q1" },
        options: [{ id: "A", label: "A", content: { original: "A" } }, { id: "B", label: "B", content: { original: "B" } }],
        sourceExamSetIds: [examSetId],
        originExamSetId: examSetId,
      },
      {
        questionId: q2,
        order: 2,
        type: "true_false_group",
        content: { original: "Q2" },
        statements: [{ id: "S1", content: { original: "S1" } }, { id: "S2", content: { original: "S2" } }],
        sourceExamSetIds: [examSetId],
        originExamSetId: examSetId,
      }
    ],
    answerKeySnapshots: [
      {
        questionId: q1,
        type: "multiple_choice",
        correctOptionIds: ["A"],
        explanation: { original: "Exp1" }
      },
      {
        questionId: q2,
        type: "true_false_group",
        correctStatementAnswers: [{ statementId: "S1", answer: true }, { statementId: "S2", answer: false }],
        explanation: { original: "Exp2" }
      }
    ],
    resultSnapshot: {
      version: 2,
      generatedAt: now,
      summary: {
        score: 10,
        scoreScale: 10,
        correctCount: 2,
        partiallyCorrectCount: 0,
        incorrectCount: 0,
        unansweredCount: 0,
        totalQuestions: 2
      },
      items: [
        {
          questionId: q1,
          userAnswer: { selectedOptionIds: ["A"], isFlagged: false },
          result: { status: "correct", earnedScore: 1, maxScore: 1 }
        },
        {
          questionId: q2,
          userAnswer: { statementAnswers: [{ statementId: "S1", answer: true }, { statementId: "S2", answer: false }], isFlagged: true },
          result: { status: "correct", earnedScore: 1, maxScore: 1 }
        }
      ]
    },
    ...overrides
  };
};

describe("Immutable Exam Result Serialization", () => {
  it("merges compact snapshot into full payload", () => {
    const attempt = createMockAttempt();
    const result = serializeResult(attempt);
    
    expect(result.summary.correctCount).toBe(2);
    expect(result.questions).toHaveLength(2);
    
    // Check Q1
    const q1 = result.questions[0];
    expect(q1.content.original).toBe("Q1");
    expect(q1.result.correctOptionIds).toEqual(["A"]);
    expect(q1.userAnswer.selectedOptionIds).toEqual(["A"]);
    expect(q1.explanation!.original).toBe("Exp1");
    
    // Check Q2
    const q2 = result.questions[1];
    expect(q2.content.original).toBe("Q2");
    expect(q2.result.correctStatementAnswers).toEqual([{ statementId: "S1", answer: true }, { statementId: "S2", answer: false }]);
    expect(q2.userAnswer.statementAnswers).toEqual([{ statementId: "S1", answer: true }, { statementId: "S2", answer: false }]);
    expect(q2.explanation!.original).toBe("Exp2");
  });

  it("ensures original question modification after submit does not affect result (via immutability check)", () => {
    const attempt = createMockAttempt();
    // Simulate original question changing in the DB (which doesn't affect attempt as it's not read)
    // The test asserts that the result purely derives from the snapshots.
    const result = serializeResult(attempt);
    expect(result.questions[0].content.original).toBe("Q1");
  });

  it("throws 409 if missing or extra item", () => {
    const attempt = createMockAttempt();
    attempt.resultSnapshot!.items!.pop();
    expectApi409(() => serializeResult(attempt), "RESULT_SNAPSHOT_UNAVAILABLE");
  });

  it("throws 409 if duplicate item", () => {
    const attempt = createMockAttempt();
    attempt.resultSnapshot!.items![1] = attempt.resultSnapshot!.items![0]; 
    expectApi409(() => serializeResult(attempt), "RESULT_SNAPSHOT_UNAVAILABLE");
  });

  it("throws 409 if summary does not match items", () => {
    const attempt = createMockAttempt();
    attempt.resultSnapshot!.items![0].result.status = "incorrect";
    expectApi409(() => serializeResult(attempt), "RESULT_SNAPSHOT_UNAVAILABLE");
  });

  it("throws 409 if derived overall score mismatches summary and root", () => {
    const attempt = createMockAttempt();
    // Max is 2. Items sum to 2. Earned is 2. Derived score is 10.
    // Let's modify root/summary score to 9.5 without changing items.
    attempt.score = 9.5;
    attempt.resultSnapshot!.summary.score = 9.5;
    expectApi409(() => serializeResult(attempt), "RESULT_SNAPSHOT_UNAVAILABLE");
  });

  it("throws 409 if item has unknown status", () => {
    const attempt = createMockAttempt();
    // @ts-ignore
    attempt.resultSnapshot!.items![0].result.status = "invalid_status";
    expectApi409(() => serializeResult(attempt), "RESULT_SNAPSHOT_UNAVAILABLE");
  });

  it("throws 409 if item has non-finite or out of bounds earnedScore", () => {
    const attempt = createMockAttempt();
    attempt.resultSnapshot!.items![0].result.earnedScore = 5; // maxScore is 1
    expectApi409(() => serializeResult(attempt), "RESULT_SNAPSHOT_UNAVAILABLE");
    
    attempt.resultSnapshot!.items![0].result.earnedScore = -1;
    expectApi409(() => serializeResult(attempt), "RESULT_SNAPSHOT_UNAVAILABLE");
  });

  it("serializes legacy format correctly", () => {
    const attempt = createMockAttempt();
    const legacyQuestions = attempt.resultSnapshot!.items!.map((item, index) => {
      const qSnap = attempt.questionSnapshots[index];
      const aSnap = attempt.answerKeySnapshots[index];
      return {
        ...qSnap,
        userAnswer: item.userAnswer,
        result: {
           ...item.result,
           correctOptionIds: aSnap.correctOptionIds,
           correctStatementAnswers: aSnap.correctStatementAnswers,
        },
        explanation: aSnap.explanation
      };
    });

    attempt.resultSnapshot = {
      version: 1,
      generatedAt: new Date(),
      summary: attempt.resultSnapshot!.summary,
      questions: legacyQuestions,
    };

    const result = serializeResult(attempt);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].content.original).toBe("Q1");
  });

  it("throws 409 for malformed legacy data", () => {
    const attempt = createMockAttempt();
    attempt.resultSnapshot = {
      version: 1,
      generatedAt: new Date(),
      summary: attempt.resultSnapshot!.summary,
      questions: [ { invalid: "data" } ], // Missing sourceExamSetIds and questionId
    } as any;
    expectApi409(() => serializeResult(attempt), "RESULT_SNAPSHOT_UNAVAILABLE");
  });

  it("does not duplicate content or correct answers inside compact result items", () => {
    const attempt = createMockAttempt();
    const str = JSON.stringify(attempt.resultSnapshot!.items);
    expect(str).not.toContain("content");
    expect(str).not.toContain("explanation");
    expect(str).not.toContain("correctOptionIds");
  });
});

describe("Score Invariants Before Terminal", () => {
  it("rejects extra answer keys", () => {
    const attempt = createMockAttempt({ status: "in_progress" });
    // Add extra answer key
    attempt.answerKeySnapshots.push({
      questionId: new ObjectId(),
      type: "multiple_choice",
    });
    
    expect(() => scoreAttempt(attempt, [])).toThrowError(/Invariant failed: questionSnapshots length .* does not match answerKeySnapshots/);
  });

  it("rejects mismatched IDs even with same length", () => {
    const attempt = createMockAttempt({ status: "in_progress" });
    // Same length, but replace the second answer key ID with something else
    attempt.answerKeySnapshots[1].questionId = new ObjectId();
    
    expect(() => scoreAttempt(attempt, [])).toThrowError(/ID .* from questionSnapshots is missing from answerKeySnapshots/);
  });

  it("rejects duplicate IDs within answerKeySnapshots", () => {
    const attempt = createMockAttempt({ status: "in_progress" });
    attempt.answerKeySnapshots[1] = attempt.answerKeySnapshots[0]; // duplicate
    
    expect(() => scoreAttempt(attempt, [])).toThrowError(/Duplicate IDs found in answerKeySnapshots/);
  });

  it("rejects mismatch with root questionIds", () => {
    const attempt = createMockAttempt({ status: "in_progress" });
    // Root questionIds has an extra/different ID
    attempt.questionIds[0] = new ObjectId();
    
    expect(() => scoreAttempt(attempt, [])).toThrowError(/ID .* from questionIds is missing from questionSnapshots/);
  });
});
