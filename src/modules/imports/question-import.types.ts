import type { ObjectId } from "mongodb";

export type QuestionImportJobStatus = "pending" | "processing" | "completed" | "failed";

export interface QuestionImportIssue {
  row: number;
  message: string;
}

export interface QuestionImportJobDocument {
  _id: ObjectId;
  userId: ObjectId;
  subjectId: ObjectId;
  examSetId?: ObjectId;
  fileName: string;
  status: QuestionImportJobStatus;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  issues: QuestionImportIssue[];
  createdAt: Date;
  updatedAt: Date;
}
