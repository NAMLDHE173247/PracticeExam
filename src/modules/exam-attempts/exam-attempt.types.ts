import type { ObjectId } from "mongodb";
import type { LocalizedText, QuestionType } from "../questions/question.types";

export type ExamMode = "exam" | "practice";
export type AttemptStatus = "in_progress" | "submitted" | "expired";

export interface ExamAttemptQuestionSnapshot {
  questionId: ObjectId;
  order: number;
  type: QuestionType;
  content: LocalizedText;
  options?: Array<{ id: string; label: string; content: LocalizedText }>;
  statements?: Array<{ id: string; content: LocalizedText }>;
}

export interface ExamAttemptDocument {
  _id: ObjectId;
  userId: ObjectId;
  subjectId: ObjectId;
  examSetId?: ObjectId;
  mode: ExamMode;
  status: AttemptStatus;
  startedAt: Date;
  submittedAt?: Date;
  expiresAt?: Date;
  questionSnapshots: ExamAttemptQuestionSnapshot[];
  score?: number;
  maxScore?: number;
  createdAt: Date;
  updatedAt: Date;
}
