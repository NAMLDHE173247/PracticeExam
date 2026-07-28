import type { QuestionDocument } from "../questions/question.types";
import type { ExamAttemptAnswerKey, ExamAttemptQuestionSnapshot } from "./exam-attempt.types";
import { shuffle, type RandomIndex } from "./exam-attempt-selection";

import type { ObjectId } from "mongodb";

export function createAttemptSnapshot(question: QuestionDocument, order: number, shuffleOptions: boolean, randomIndex?: RandomIndex, sourceExamSetIds?: ObjectId[]): ExamAttemptQuestionSnapshot {
  const options = question.options?.map(({ id, label, content }) => ({ id, label, content: { ...content } }));
  if (!sourceExamSetIds || sourceExamSetIds.length === 0) {
    throw new Error("sourceExamSetIds must be provided");
  }
  const filteredSourceExamSetIds = question.examSetIds.filter(id => sourceExamSetIds.some(sourceId => sourceId.equals(id)));
  if (filteredSourceExamSetIds.length === 0) {
    throw new Error(`Question ${question._id.toHexString()} does not belong to any provided source exam sets`);
  }
  return {
    questionId: question._id,
    order,
    type: question.type,
    content: { ...question.content },
    options: options && shuffleOptions ? shuffle(options, randomIndex) : options,
    statements: question.statements?.map(({ id, content }) => ({ id, content: { ...content } })),
    sourceExamSetIds: filteredSourceExamSetIds,
    originExamSetId: filteredSourceExamSetIds[0],
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
