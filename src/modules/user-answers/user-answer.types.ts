import type { ObjectId } from "mongodb";
import type { QuestionType } from "../questions/question.types";

export interface UserAnswerDocument {
  _id: ObjectId;
  attemptId: ObjectId;
  userId: ObjectId;
  questionId: ObjectId;
  questionType: QuestionType;
  selectedOptionIds?: string[];
  trueFalseAnswers?: Record<string, boolean>;
  grading?: {
    isCorrect: boolean;
    earnedScore: number;
  };
  answeredAt: Date;
  updatedAt: Date;
}
