import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { multipleChoiceSchema, singleChoiceSchema, trueFalseGroupSchema } from "../src/modules/questions/question.schema";
import { subjectSchema } from "../src/modules/subjects/subject.schema";

const subjectId = new ObjectId().toHexString();
const examSetId = new ObjectId().toHexString();
const text = { original: "Question", vi: "Câu hỏi" };
const option = (id: string, label: string, isCorrect: boolean) => ({ id, label, content: text, isCorrect });
const base = { subjectId, examSetIds: [examSetId], content: text, contentHash: "hash" };
const options = (count: number, correctIndex = 0) => Array.from({ length: count }, (_, index) => option(String.fromCharCode(65 + index), `Label ${index}`, index === correctIndex));

describe("question validation", () => {
  it("normalizes subject code and trims names", () => {
    expect(subjectSchema.parse({ code: " enw492c ", name: " English " })).toMatchObject({ code: "ENW492C", name: "English", isActive: true });
  });

  it("accepts valid 2-option and 8-option single-choice questions", () => {
    expect(singleChoiceSchema.safeParse({ ...base, type: "single_choice", options: options(2) }).success).toBe(true);
    expect(singleChoiceSchema.safeParse({ ...base, type: "single_choice", options: options(8) }).success).toBe(true);
  });

  it("rejects single-choice questions with 1 or 9 options", () => {
    expect(singleChoiceSchema.safeParse({ ...base, type: "single_choice", options: options(1) }).success).toBe(false);
    expect(singleChoiceSchema.safeParse({ ...base, type: "single_choice", options: options(9) }).success).toBe(false);
  });

  it("rejects duplicate option ids and case-insensitive labels", () => {
    expect(singleChoiceSchema.safeParse({ ...base, type: "single_choice", options: [option("A", "One", true), option("A", "Two", false)] }).success).toBe(false);
    expect(singleChoiceSchema.safeParse({ ...base, type: "single_choice", options: [option("A", "Answer", true), option("B", " answer ", false)] }).success).toBe(false);
  });

  it("rejects invalid subjectId and examSetIds", () => {
    expect(singleChoiceSchema.safeParse({ ...base, subjectId: "bad", type: "single_choice", options: options(2) }).success).toBe(false);
    expect(singleChoiceSchema.safeParse({ ...base, examSetIds: ["bad"], type: "single_choice", options: options(2) }).success).toBe(false);
  });

  it("enforces single-choice correct answer count", () => {
    expect(singleChoiceSchema.safeParse({ ...base, type: "single_choice", options: options(2, -1) }).success).toBe(false);
    expect(singleChoiceSchema.safeParse({ ...base, type: "single_choice", options: [option("A", "A", true), option("B", "B", true)] }).success).toBe(false);
  });

  it("enforces multiple-choice answer rules and supports eight options", () => {
    expect(multipleChoiceSchema.safeParse({ ...base, type: "multiple_choice", options: [option("A", "A", true), option("B", "B", true), option("C", "C", false)] }).success).toBe(true);
    expect(multipleChoiceSchema.safeParse({ ...base, type: "multiple_choice", options: options(8, 0).map((item, index) => ({ ...item, isCorrect: index < 2 })) }).success).toBe(true);
    expect(multipleChoiceSchema.safeParse({ ...base, type: "multiple_choice", options: [option("A", "A", true), option("B", "B", false)] }).success).toBe(false);
    expect(multipleChoiceSchema.safeParse({ ...base, type: "multiple_choice", options: [option("A", "A", true), option("B", "B", true)] }).success).toBe(false);
  });

  it("limits true/false groups to ten unique statements and rejects options", () => {
    const statements = Array.from({ length: 10 }, (_, index) => ({ id: `S${index}`, content: text, answer: index % 2 === 0 }));
    expect(trueFalseGroupSchema.safeParse({ ...base, type: "true_false_group", statements }).success).toBe(true);
    expect(trueFalseGroupSchema.safeParse({ ...base, type: "true_false_group", statements: [...statements, { id: "S10", content: text, answer: true }] }).success).toBe(false);
    expect(trueFalseGroupSchema.safeParse({ ...base, type: "true_false_group", statements, options: [] }).success).toBe(false);
  });

  it("trims tags, removes empty values and deduplicates case-insensitively", () => {
    const parsed = singleChoiceSchema.parse({ ...base, type: "single_choice", tags: [" Web ", "web", "", "  ", "UX"], options: options(2) });
    expect(parsed.tags).toEqual(["Web", "UX"]);
  });
});
