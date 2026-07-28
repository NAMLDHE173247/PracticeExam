import type { QuestionDocument } from "../questions/question.types";
import type { ExamAttemptAnswerKey, ExamAttemptQuestionSnapshot } from "./exam-attempt.types";
import { shuffle, type RandomIndex } from "./exam-attempt-selection";

export function createAttemptSnapshot(question: QuestionDocument, order: number, shuffleOptions: boolean, randomIndex?: RandomIndex): ExamAttemptQuestionSnapshot {
  const options = question.options?.map(({ id, label, content }) => ({ id, label, content: { ...content } }));
  return {
    questionId: question._id,
    order,
    type: question.type,
    content: { ...question.content },
    options: options && shuffleOptions ? shuffle(options, randomIndex) : options,
    statements: question.statements?.map(({ id, content }) => ({ id, content: { ...content } })),
    sourceExamSetIds: [...question.examSetIds],
  };
}

export function createAnswerKeySnapshot(question: QuestionDocument): ExamAttemptAnswerKey {
  return {
    questionId: question._id,
    type: question.type,
    ...(question.options ? { correctOptionIds: question.options.filter((option) => option.isCorrect).map((option) => option.id) } : {}),
    ...(question.statements ? { correctStatementAnswers: question.statements.map((statement) => ({ statementId: statement.id, answer: statement.answer })) } : {}),
  };
}
