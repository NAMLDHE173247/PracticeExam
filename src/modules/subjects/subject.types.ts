import type { ObjectId } from "mongodb";

export interface SubjectDocument {
  _id: ObjectId;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SubjectInput = Omit<SubjectDocument, "_id" | "createdAt" | "updatedAt">;
