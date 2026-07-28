import type { ObjectId } from "mongodb";

export type QuestionType = "single_choice" | "multiple_choice" | "true_false_group";
export type QuestionStatus = "draft" | "published" | "archived";

export interface LocalizedText {
  original: string;
  vi?: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  content: LocalizedText;
  isCorrect: boolean;
}

export interface TrueFalseStatement {
  id: string;
  content: LocalizedText;
  answer: boolean;
}

export interface QuestionDocument {
  _id: ObjectId;
  subjectId: ObjectId;
  examSetIds: ObjectId[];
  type: QuestionType;
  content: LocalizedText;
  options?: QuestionOption[];
  statements?: TrueFalseStatement[];
  explanation?: LocalizedText;
  difficulty?: "easy" | "medium" | "hard";
  tags: string[];
  status: QuestionStatus;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}
