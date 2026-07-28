import type { ObjectId } from "mongodb";
import type { QuestionType } from "../questions/question.types";

export interface UserAnswerDocument {
  _id: ObjectId;
  attemptId: ObjectId;
  userId: ObjectId;
  questionId: ObjectId;
  questionType: QuestionType;
  isFlagged?: boolean;
  selectedOptionIds?: string[];
  statementAnswers?: Array<{ statementId: string; answer: boolean }>;
  grading?: {
    isCorrect: boolean;
    isPartiallyCorrect: boolean;
    earnedScore: number;
    maxScore: number;
    correctOptionIds?: string[];
    correctStatementAnswers?: Array<{ statementId: string; answer: boolean }>;
  };
  answeredAt?: Date;
  updatedAt: Date;
}
