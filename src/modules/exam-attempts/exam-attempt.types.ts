import type { ObjectId } from "mongodb";
import type { LocalizedText, QuestionType } from "../questions/question.types";

export type ExamMode = "exam_set" | "mixed";
export type AttemptStatus = "in_progress" | "submitting" | "submitted" | "expired" | "abandoned";
export type SubmitReason = "manual" | "timeout";

export interface ExamAttemptQuestionSnapshot {
  questionId: ObjectId;
  order: number;
  type: QuestionType;
  content: LocalizedText;
  options?: Array<{ id: string; label: string; content: LocalizedText }>;
  statements?: Array<{ id: string; content: LocalizedText }>;
  sourceExamSetIds: ObjectId[];
}

export interface ExamAttemptAnswerKey {
  questionId: ObjectId;
  type: QuestionType;
  correctOptionIds?: string[];
  correctStatementAnswers?: Array<{ statementId: string; answer: boolean }>;
}

export interface ExamAttemptSettings {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showTranslation: boolean;
  scoringMode: "strict" | "partial";
}

export interface ExamAttemptDocument {
  _id: ObjectId;
  userId: ObjectId;
  mode: ExamMode;
  subjectId: ObjectId;
  examSetId?: ObjectId;
  sourceExamSetIds: ObjectId[];
  questionIds: ObjectId[];
  questionSnapshots: ExamAttemptQuestionSnapshot[];
  answerKeySnapshots: ExamAttemptAnswerKey[];
  durationSeconds: number;
  status: AttemptStatus;
  startedAt: Date;
  deadlineAt: Date;
  lastSavedAt: Date;
  submittedAt?: Date;
  submitReason?: SubmitReason;
  score?: number;
  scoreScale: 10;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  partiallyCorrectCount?: number;
  totalEarnedPoints?: number;
  totalMaxPoints?: number;
  settings: ExamAttemptSettings;
  createdAt: Date;
  updatedAt: Date;
}
