import type { ExamAttemptQuestionSnapshot } from "../exam-attempts/exam-attempt.types";
import type { QuestionDocument } from "./question.types";

export function createAttemptQuestionSnapshot(
  question: QuestionDocument,
  order: number,
): ExamAttemptQuestionSnapshot {
  return {
    questionId: question._id,
    order,
    type: question.type,
    content: { ...question.content },
    options: question.options?.map(({ id, label, content }) => ({ id, label, content: { ...content } })),
    statements: question.statements?.map(({ id, content }) => ({ id, content: { ...content } })),
    sourceExamSetIds: [...question.examSetIds],
  };
}
