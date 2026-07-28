import type { ObjectId } from "mongodb";
import type { LocalizedText, QuestionType } from "../questions/question.types";
import type { ExamAttemptSettings, ExamMode } from "../exam-attempts/exam-attempt.types";

export interface SerializedExamResultQuestion {
  questionId: string;
  order: number;
  type: QuestionType;
  content: LocalizedText;
  options?: Array<{
    id: string;
    label: string;
    content: LocalizedText;
  }>;
  statements?: Array<{
    id: string;
    content: LocalizedText;
  }>;
  userAnswer: {
    selectedOptionIds?: string[];
    statementAnswers?: Array<{ statementId: string; answer: boolean }>;
    isFlagged: boolean;
  };
  result: {
    status: "correct" | "partial" | "incorrect" | "unanswered";
    earnedScore: number;
    maxScore: number;
    correctOptionIds?: string[];
    correctStatementAnswers?: Array<{ statementId: string; answer: boolean }>;
  };
  explanation?: LocalizedText;
  sourceExamSetIds: string[];
  originExamSetId?: string;
}

export interface SerializedExamResult {
  attemptId: string;
  mode: ExamMode;
  subjectId: string;
  examSetId?: string;
  sourceExamSetIds: string[];
  status: "submitted" | "expired";
  submitReason?: "manual" | "timeout" | "abandoned" | "system";
  startedAt: string;
  submittedAt: string;
  durationSeconds: number;
  generatedAt: string;
  settings: ExamAttemptSettings;
  summary: {
    score: number;
    scoreScale: 10;
    correctCount: number;
    partiallyCorrectCount: number;
    incorrectCount: number;
    unansweredCount: number;
    totalQuestions: number;
  };
  questions: SerializedExamResultQuestion[];
}

export interface LegacyExamResultQuestionSnapshot {
  questionId: ObjectId | string;
  order: number;
  type: QuestionType;
  content: LocalizedText;
  options?: Array<{
    id: string;
    label: string;
    content: LocalizedText;
  }>;
  statements?: Array<{
    id: string;
    content: LocalizedText;
  }>;
  userAnswer: {
    selectedOptionIds?: string[];
    statementAnswers?: Array<{ statementId: string; answer: boolean }>;
    isFlagged: boolean;
  };
  result: {
    status: "correct" | "partial" | "incorrect" | "unanswered";
    earnedScore: number;
    maxScore: number;
    correctOptionIds?: string[];
    correctStatementAnswers?: Array<{ statementId: string; answer: boolean }>;
  };
  explanation?: LocalizedText;
  sourceExamSetIds: Array<ObjectId | string>;
  originExamSetId?: ObjectId | string;
}
