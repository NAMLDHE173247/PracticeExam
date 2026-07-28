import { describe, expect, it } from "vitest";
import { examSetSchema } from "../src/modules/exam-sets/exam-set.schema";
import { multipleChoiceSchema, singleChoiceSchema, trueFalseGroupSchema } from "../src/modules/questions/question.schema";
import { subjectSchema } from "../src/modules/subjects/subject.schema";

const text = { original: "Question" };
const option = (id: string, isCorrect: boolean) => ({ id, label: id, content: text, isCorrect });

describe("validation", () => {
  it("normalizes subject code and trims names", () => {
    expect(subjectSchema.parse({ code: " enw492c ", name: " English " })).toMatchObject({ code: "ENW492C", name: "English", isActive: true });
  });

  it("validates an exam set subject id", () => {
    expect(examSetSchema.safeParse({ subjectId: "not-an-object-id", title: "Set" }).success).toBe(false);
  });

  it("requires exactly one correct single-choice option", () => {
    const value = { type: "single_choice", subjectId: "s", content: text, contentHash: "h", options: [option("A", true), option("B", true)] };
    expect(singleChoiceSchema.safeParse(value).success).toBe(false);
  });

  it("requires multiple-choice answers to be neither empty nor all correct", () => {
    const value = { type: "multiple_choice", subjectId: "s", content: text, contentHash: "h", options: [option("A", true), option("B", true)] };
    expect(multipleChoiceSchema.safeParse(value).success).toBe(false);
  });

  it("validates unique true/false statement ids", () => {
    const value = { type: "true_false_group", subjectId: "s", content: text, contentHash: "h", statements: [{ id: "1", content: text, answer: true }, { id: "1", content: text, answer: false }] };
    expect(trueFalseGroupSchema.safeParse(value).success).toBe(false);
  });
});
