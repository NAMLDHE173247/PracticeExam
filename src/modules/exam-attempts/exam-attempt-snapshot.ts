import type { QuestionDocument } from "../questions/question.types";
import type { ExamAttemptAnswerKey, ExamAttemptQuestionSnapshot } from "./exam-attempt.types";
import { shuffle, type RandomIndex } from "./exam-attempt-selection";

import type { ObjectId } from "mongodb";

export function createAttemptSnapshot(question: QuestionDocument, order: number, shuffleOptions: boolean, randomIndex?: RandomIndex, sourceExamSetIds?: ObjectId[]): ExamAttemptQuestionSnapshot {
  const options = question.options?.map(({ id, label, content }) => ({ id, label, content: { ...content } }));
  let originExamSetId = question.examSetIds[0];
  if (sourceExamSetIds && sourceExamSetIds.length > 0) {
    const match = question.examSetIds.find(id => sourceExamSetIds.some(sourceId => sourceId.equals(id)));
    if (match) originExamSetId = match;
  }
  return {
    questionId: question._id,
    order,
    type: question.type,
    content: { ...question.content },
    options: options && shuffleOptions ? shuffle(options, randomIndex) : options,
    statements: question.statements?.map(({ id, content }) => ({ id, content: { ...content } })),
    sourceExamSetIds: [...question.examSetIds],
    ...(originExamSetId ? { originExamSetId } : {}),
  };
}

export function createAnswerKeySnapshot(question: QuestionDocument): ExamAttemptAnswerKey {
  return {
    questionId: question._id,
    type: question.type,
    ...(question.options ? { correctOptionIds: question.options.filter((option) => option.isCorrect).map((option) => option.id) } : {}),
    ...(question.statements ? { correctStatementAnswers: question.statements.map((statement) => ({ statementId: statement.id, answer: statement.answer })) } : {}),
    ...(question.explanation ? { explanation: { ...question.explanation } } : {}),
  };
}
