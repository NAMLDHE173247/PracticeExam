import { gradeMultipleChoice, gradeSingleChoice, gradeTrueFalseGroup, type GradeResult } from "../questions/question-grading";
import type { ExamAttemptAnswerKey, ExamAttemptDocument } from "./exam-attempt.types";
import type { UserAnswerDocument } from "../user-answers/user-answer.types";

export function roundScore(value: number): number { return Math.round(value * 10) / 10; }

function gradeQuestion(attempt: ExamAttemptDocument, key: ExamAttemptAnswerKey, answer: UserAnswerDocument | undefined): GradeResult {
  const snapshot = attempt.questionSnapshots.find((item) => item.questionId.equals(key.questionId));
  if (!snapshot) return { isCorrect: false, isPartiallyCorrect: false, earnedScore: 0, maxScore: 1 };
  if (key.type === "single_choice") {
    const options = snapshot.options?.map((option) => ({ ...option, isCorrect: key.correctOptionIds?.includes(option.id) ?? false })) ?? [];
    return gradeSingleChoice(options, answer?.selectedOptionIds ?? []);
  }
  if (key.type === "multiple_choice") {
    const options = snapshot.options?.map((option) => ({ ...option, isCorrect: key.correctOptionIds?.includes(option.id) ?? false })) ?? [];
    return gradeMultipleChoice(options, answer?.selectedOptionIds ?? [], attempt.settings.scoringMode);
  }
  const statements = snapshot.statements?.map((statement) => ({ ...statement, answer: key.correctStatementAnswers?.find((item) => item.statementId === statement.id)?.answer ?? false })) ?? [];
  return gradeTrueFalseGroup(statements, Object.fromEntries(answer?.statementAnswers?.map((item) => [item.statementId, item.answer]) ?? []), attempt.settings.scoringMode);
}

function assertUniqueIds(ids: string[], name: string) {
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error(`Invariant failed: Duplicate IDs found in ${name}`);
  }
}

function assertSameIdSet(setA: string[], setB: string[], nameA: string, nameB: string) {
  if (setA.length !== setB.length) {
    throw new Error(`Invariant failed: ${nameA} length (${setA.length}) does not match ${nameB} length (${setB.length})`);
  }
  const uniqueB = new Set(setB);
  for (const id of setA) {
    if (!uniqueB.has(id)) {
      throw new Error(`Invariant failed: ID ${id} from ${nameA} is missing from ${nameB}`);
    }
  }
}

export function scoreAttempt(attempt: ExamAttemptDocument, answers: UserAnswerDocument[]) {
  const rootQuestionIds = attempt.questionIds.map(id => id.toHexString());
  const snapshotQuestionIds = attempt.questionSnapshots.map(s => s.questionId.toHexString());
  const answerKeyIds = attempt.answerKeySnapshots.map(k => k.questionId.toHexString());

  assertUniqueIds(rootQuestionIds, "questionIds");
  assertUniqueIds(snapshotQuestionIds, "questionSnapshots");
  assertUniqueIds(answerKeyIds, "answerKeySnapshots");

  assertSameIdSet(rootQuestionIds, snapshotQuestionIds, "questionIds", "questionSnapshots");
  assertSameIdSet(snapshotQuestionIds, answerKeyIds, "questionSnapshots", "answerKeySnapshots");

  const answerKeyMap = new Map(attempt.answerKeySnapshots.map(k => [k.questionId.toHexString(), k]));
  for (const snapshot of attempt.questionSnapshots) {
    const key = answerKeyMap.get(snapshot.questionId.toHexString());
    if (!key || key.type !== snapshot.type) {
      throw new Error(`Invariant failed: Question type mismatch for ${snapshot.questionId.toHexString()}`);
    }

    if (key.type === "single_choice" || key.type === "multiple_choice") {
      const minOptions = key.type === "single_choice" ? 1 : 1;
      const maxOptions = key.type === "single_choice" ? 1 : undefined;
      const correctCount = key.correctOptionIds?.length ?? 0;
      if (correctCount < minOptions || (maxOptions !== undefined && correctCount > maxOptions)) {
        throw new Error(`Invariant failed: Invalid correctOptionIds length for ${snapshot.questionId.toHexString()}`);
      }
      
      const optionIds = new Set(snapshot.options?.map(o => o.id) ?? []);
      for (const id of key.correctOptionIds ?? []) {
        if (!optionIds.has(id)) {
          throw new Error(`Invariant failed: Correct option ${id} not found in options for ${snapshot.questionId.toHexString()}`);
        }
      }
    } else if (key.type === "true_false_group") {
      const statementIds = snapshot.statements?.map(s => s.id) ?? [];
      const correctStatements = key.correctStatementAnswers ?? [];
      
      assertUniqueIds(statementIds, `statements for ${snapshot.questionId.toHexString()}`);
      assertUniqueIds(correctStatements.map(s => s.statementId), `correctStatementAnswers for ${snapshot.questionId.toHexString()}`);
      assertSameIdSet(statementIds, correctStatements.map(s => s.statementId), `statements for ${snapshot.questionId.toHexString()}`, `correctStatementAnswers for ${snapshot.questionId.toHexString()}`);
    }
  }

  const answerMap = new Map(answers.map((answer) => [answer.questionId.toHexString(), answer]));
  let totalEarnedPoints = 0;
  let correctCount = 0;
  let partiallyCorrectCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  const gradings = attempt.answerKeySnapshots.map((key) => {
    const answer = answerMap.get(key.questionId.toHexString());
    const result = gradeQuestion(attempt, key, answer);
    const answered = Boolean(answer?.selectedOptionIds?.length || answer?.statementAnswers?.length);
    if (!answered) unansweredCount += 1;
    else if (result.isCorrect) correctCount += 1;
    else if (result.isPartiallyCorrect) partiallyCorrectCount += 1;
    else incorrectCount += 1;
    totalEarnedPoints += result.earnedScore;
    return { key, answer, result };
  });
  const totalMaxPoints = attempt.answerKeySnapshots.length;
  return {
    gradings,
    totalEarnedPoints,
    totalMaxPoints,
    score: roundScore(totalMaxPoints ? totalEarnedPoints / totalMaxPoints * 10 : 0),
    correctCount,
    partiallyCorrectCount,
    incorrectCount,
    unansweredCount,
  };
}
