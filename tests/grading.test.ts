import { describe, expect, it } from "vitest";
import { gradeMultipleChoice, gradeSingleChoice, gradeTrueFalseGroup } from "../src/modules/questions/question-grading";

const text = { original: "Option" };
const options = [
  { id: "A", label: "A", content: text, isCorrect: true },
  { id: "B", label: "B", content: text, isCorrect: true },
  { id: "C", label: "C", content: text, isCorrect: false },
];

describe("grading", () => {
  it("grades single choice strictly", () => {
    expect(gradeSingleChoice(options, ["A"])).toMatchObject({ isCorrect: true, earnedScore: 1 });
    expect(gradeSingleChoice(options, ["A", "B"])).toMatchObject({ isCorrect: false, earnedScore: 0 });
  });

  it("supports strict and partial multiple choice", () => {
    expect(gradeMultipleChoice(options, ["A"], "strict").earnedScore).toBe(0);
    expect(gradeMultipleChoice(options, ["A"], "partial")).toMatchObject({ isPartiallyCorrect: true, earnedScore: 0.5 });
    expect(gradeMultipleChoice(options, ["A", "B"], "strict").isCorrect).toBe(true);
    expect(gradeMultipleChoice(options, ["A", "C"], "partial").earnedScore).toBe(0);
  });

  it("supports strict and partial true/false grading", () => {
    const statements = [{ id: "1", content: text, answer: true }, { id: "2", content: text, answer: false }];
    expect(gradeTrueFalseGroup(statements, { "1": true, "2": false }, "strict").isCorrect).toBe(true);
    expect(gradeTrueFalseGroup(statements, { "1": true }, "partial").earnedScore).toBe(0.5);
  });
});
