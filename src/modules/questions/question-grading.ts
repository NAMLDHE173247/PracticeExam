import type { QuestionOption, TrueFalseStatement } from "./question.types";

export type GradingMode = "strict" | "partial";

export interface GradeResult {
  isCorrect: boolean;
  isPartiallyCorrect: boolean;
  earnedScore: number;
  maxScore: 1;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export function gradeSingleChoice(options: QuestionOption[], selectedOptionIds: string[]): GradeResult {
  const correctId = options.find((option) => option.isCorrect)?.id;
  const isCorrect = selectedOptionIds.length === 1 && selectedOptionIds[0] === correctId;
  return { isCorrect, isPartiallyCorrect: false, earnedScore: isCorrect ? 1 : 0, maxScore: 1 };
}

export function gradeMultipleChoice(
  options: QuestionOption[],
  selectedOptionIds: string[],
  mode: GradingMode = "strict",
): GradeResult {
  const correctIds = new Set(options.filter((option) => option.isCorrect).map((option) => option.id));
  const selectedIds = new Set(selectedOptionIds);
  const isCorrect = selectedIds.size === correctIds.size && [...correctIds].every((id) => selectedIds.has(id));
  const correctSelected = [...selectedIds].filter((id) => correctIds.has(id)).length;
  const incorrectSelected = [...selectedIds].filter((id) => !correctIds.has(id)).length;
  const earnedScore = mode === "strict" ? (isCorrect ? 1 : 0) : clamp((correctSelected - incorrectSelected) / correctIds.size);
  return { isCorrect, isPartiallyCorrect: !isCorrect && earnedScore > 0, earnedScore, maxScore: 1 };
}

export function gradeTrueFalseGroup(
  statements: TrueFalseStatement[],
  answers: Record<string, boolean>,
  mode: GradingMode = "strict",
): GradeResult {
  const correctCount = statements.filter((statement) => answers[statement.id] === statement.answer).length;
  const isCorrect = correctCount === statements.length;
  const earnedScore = mode === "strict" ? (isCorrect ? 1 : 0) : correctCount / statements.length;
  return { isCorrect, isPartiallyCorrect: !isCorrect && earnedScore > 0, earnedScore, maxScore: 1 };
}
