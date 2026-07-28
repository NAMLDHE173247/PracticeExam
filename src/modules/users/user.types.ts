import type { ObjectId } from "mongodb";

export type UserRole = "admin" | "student";

export interface UserDocument {
  _id: ObjectId;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
