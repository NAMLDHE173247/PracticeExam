import type { QuestionImportInput } from "./question-import.types";
import type { QuestionType } from "../questions/question.types";

export interface ImportDefaults {
  defaultStatus: "draft" | "published";
  defaultDifficulty?: "easy" | "medium" | "hard";
  defaultTranslationStatus?: "not_required" | "pending" | "translated" | "reviewed" | "failed";
}

export function normalizeImportQuestion(input: QuestionImportInput, subjectId: string, examSetIds: string[], defaults: ImportDefaults) {
  const translationStatus = input.translationStatus ?? defaults.defaultTranslationStatus;
  return {
    ...input,
    type: input.type as QuestionType,
    subjectId,
    examSetIds,
    status: input.status ?? defaults.defaultStatus,
    difficulty: input.difficulty ?? defaults.defaultDifficulty,
    ...(translationStatus ? { translationStatus } : {}),
    contentHash: "pending",
  };
}
