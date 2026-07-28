import type { ExamAttemptDocument } from "./exam-attempt.types";
import type { UserAnswerDocument } from "../user-answers/user-answer.types";

export function serializeAttempt(attempt: ExamAttemptDocument, answers: UserAnswerDocument[], serverNow = new Date()) {
  const secondsRemaining = Math.max(0, Math.floor((attempt.deadlineAt.getTime() - serverNow.getTime()) / 1000));
  const submitted = attempt.status === "submitted" || attempt.status === "expired";
  const orderedQuestions = [...attempt.questionSnapshots].sort((left, right) => left.order - right.order);
  return {
    id: attempt._id.toHexString(),
    mode: attempt.mode,
    subjectId: attempt.subjectId.toHexString(),
    ...(attempt.examSetId ? { examSetId: attempt.examSetId.toHexString() } : {}),
    sourceExamSetIds: attempt.sourceExamSetIds.map((id) => id.toHexString()),
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    ...(attempt.submittedAt ? { submittedAt: attempt.submittedAt.toISOString() } : {}),
    ...(attempt.submitReason ? { submitReason: attempt.submitReason } : {}),
    secondsRemaining,
    mustSubmit: secondsRemaining === 0 && attempt.status === "in_progress",
    settings: attempt.settings,
    questions: orderedQuestions.map((question) => ({ ...question, questionId: question.questionId.toHexString(), sourceExamSetIds: question.sourceExamSetIds.map((id) => id.toHexString()) })),
    answers: answers.map((answer) => ({
      questionId: answer.questionId.toHexString(),
      ...(answer.selectedOptionIds ? { selectedOptionIds: answer.selectedOptionIds } : {}),
      ...(answer.statementAnswers ? { statementAnswers: answer.statementAnswers } : {}),
      isFlagged: answer.isFlagged ?? false,
      ...(answer.answeredAt ? { answeredAt: answer.answeredAt.toISOString() } : {}),
      ...(submitted && answer.grading ? { grading: answer.grading } : {}),
    })),
    ...(submitted ? { score: attempt.score, correctCount: attempt.correctCount, incorrectCount: attempt.incorrectCount, unansweredCount: attempt.unansweredCount, partiallyCorrectCount: attempt.partiallyCorrectCount } : {}),
  };
}
