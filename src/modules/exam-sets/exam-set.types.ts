import type { ObjectId } from "mongodb";

export type ExamSetStatus = "draft" | "published" | "archived";

export interface ExamSetDocument {
  _id: ObjectId;
  subjectId: ObjectId;
  title: string;
  description?: string;
  status: ExamSetStatus;
  durationMinutes?: number;
  passingScore?: number;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LegacyQuestionSetDocument {
  _id: ObjectId;
  id?: string;
  subject: string;
  title: string;
  description?: string;
  questions: number;
  status?: string;
  accent?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
