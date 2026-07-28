import { describe, expect, it } from "vitest";
import { gradeMultipleChoice, gradeSingleChoice, gradeTrueFalseGroup } from "../src/modules/questions/question-grading";

const text = { original: "Option" };
const singleOptions = [
  { id: "A", label: "A", content: text, isCorrect: true },
  { id: "B", label: "B", content: text, isCorrect: false },
];
const multipleOptions = [
  { id: "A", label: "A", content: text, isCorrect: true },
  { id: "B", label: "B", content: text, isCorrect: true },
  { id: "C", label: "C", content: text, isCorrect: false },
];

describe("grading", () => {
  it("grades single choice strictly", () => {
    expect(gradeSingleChoice(singleOptions, ["A"])).toMatchObject({ isCorrect: true, earnedScore: 1 });
    expect(gradeSingleChoice(singleOptions, ["A", "B"])).toMatchObject({ isCorrect: false, earnedScore: 0 });
  });

  it("supports strict and partial multiple choice", () => {
    expect(gradeMultipleChoice(multipleOptions, ["A"], "strict").earnedScore).toBe(0);
    expect(gradeMultipleChoice(multipleOptions, ["A"], "partial")).toMatchObject({ isPartiallyCorrect: true, earnedScore: 0.5 });
    expect(gradeMultipleChoice(multipleOptions, ["A", "B"], "strict").isCorrect).toBe(true);
    expect(gradeMultipleChoice(multipleOptions, ["A", "B", "C"], "partial").earnedScore).toBe(0.5);
  });

  it("supports strict and partial true/false grading", () => {
    const statements = [{ id: "1", content: text, answer: true }, { id: "2", content: text, answer: false }];
    expect(gradeTrueFalseGroup(statements, { "1": true, "2": false }, "strict").isCorrect).toBe(true);
    expect(gradeTrueFalseGroup(statements, { "1": true }, "partial").earnedScore).toBe(0.5);
  });
});
