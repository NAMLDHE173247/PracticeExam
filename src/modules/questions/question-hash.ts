import { createHash } from "crypto";
import type { LocalizedText, QuestionOption, QuestionType, TrueFalseStatement } from "./question.types";

export interface QuestionHashInput {
  type: QuestionType;
  content: LocalizedText;
  options?: QuestionOption[];
  statements?: TrueFalseStatement[];
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/ *\n */g, "\n").trim().toLowerCase();
}

export function createQuestionContentHash(question: QuestionHashInput): string {
  const canonical = {
    type: question.type,
    content: normalizeText(question.content.original),
    options: question.options?.map((option) => ({ label: normalizeText(option.label), content: normalizeText(option.content.original), isCorrect: option.isCorrect })),
    statements: question.statements?.map((statement) => ({ content: normalizeText(statement.content.original), answer: statement.answer })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
