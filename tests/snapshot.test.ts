import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { createAttemptQuestionSnapshot } from "../src/modules/questions/question-snapshot";

describe("attempt snapshot", () => {
  it("removes correct answers from options and true/false statements", () => {
    const snapshot = createAttemptQuestionSnapshot({
      _id: new ObjectId(), subjectId: new ObjectId(), examSetIds: [], type: "single_choice",
      content: { original: "Question" }, options: [{ id: "A", label: "A", content: { original: "Answer" }, isCorrect: true }],
      statements: [{ id: "S1", content: { original: "Statement" }, answer: true }], tags: [], status: "published", contentHash: "h", createdAt: new Date(), updatedAt: new Date(),
    }, 0);
    expect(JSON.stringify(snapshot)).not.toContain("isCorrect");
    expect(JSON.stringify(snapshot)).not.toContain('"answer"');
  });
});
