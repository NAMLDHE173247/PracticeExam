import type { ObjectId } from "mongodb";
import type { QuestionInput } from "../questions/question.schema";

export type ImportInputFormat = "json" | "structured_text";
export type DuplicatePolicy = "reject" | "skip" | "allow";
export type QuestionImportJobStatus = "ready" | "importing" | "completed" | "failed" | "cancelled";
export type ImportItemStatus = "valid" | "invalid" | "duplicate_in_batch" | "duplicate_in_database" | "skipped";
export type ImportIssueSeverity = "error" | "warning";

export interface QuestionImportIssue {
  itemIndex?: number;
  questionNumber?: number;
  field?: string;
  code: string;
  message: string;
  severity: ImportIssueSeverity;
}

export type QuestionImportInput = Omit<QuestionInput, "subjectId" | "examSetIds" | "contentHash">;

export interface ImportPreviewItem {
  itemIndex: number;
  questionNumber?: number;
  status: ImportItemStatus;
  normalizedQuestion?: QuestionImportInput;
  contentHash?: string;
  duplicateQuestionId?: ObjectId;
  issues: QuestionImportIssue[];
}

export interface QuestionImportJobDocument {
  _id: ObjectId;
  subjectId: ObjectId;
  targetExamSetIds: ObjectId[];
  inputFormat: ImportInputFormat;
  fileName?: string;
  duplicatePolicy: DuplicatePolicy;
  status: QuestionImportJobStatus;
  totalItems: number;
  validItems: number;
  invalidItems: number;
  duplicateItems: number;
  skippedItems: number;
  importedItems: number;
  issues: QuestionImportIssue[];
  previewItems: ImportPreviewItem[];
  createdQuestionIds: ObjectId[];
  confirmTokenHash: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  completedAt?: Date;
}
