import { ObjectId } from "mongodb";
import { z } from "zod";

const objectId = z.string().refine((value) => ObjectId.isValid(value), "Invalid ObjectId");
const statementAnswers = z.array(z.object({ statementId: z.string().trim().min(1), answer: z.boolean() }));

export const updateUserAnswerSchema = z.object({
  userId: objectId,
  questionId: objectId,
  selectedOptionIds: z.array(z.string().trim().min(1)).optional(),
  statementAnswers: statementAnswers.optional(),
  isFlagged: z.boolean().optional(),
}).refine((value) => value.selectedOptionIds !== undefined || value.statementAnswers !== undefined || value.isFlagged !== undefined, "An answer or flag is required");

export type UpdateUserAnswerInput = z.infer<typeof updateUserAnswerSchema>;
