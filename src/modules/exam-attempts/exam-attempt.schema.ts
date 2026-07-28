import { ObjectId } from "mongodb";
import { z } from "zod";

const objectId = z.string().refine((value) => ObjectId.isValid(value), "Invalid ObjectId");
const settings = z.object({
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showTranslation: z.boolean().optional(),
  scoringMode: z.enum(["strict", "partial"]).optional(),
}).optional();

export const createExamAttemptSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("exam_set"), userId: objectId, examSetId: objectId, settings }),
  z.object({
    mode: z.literal("mixed"),
    userId: objectId,
    subjectId: objectId,
    sourceExamSetIds: z.array(objectId).min(1),
    questionCount: z.number().int().min(1).max(200),
    durationMinutes: z.number().int().min(1).max(600),
    settings,
  }),
]);

export const userIdSchema = z.object({ userId: objectId });

export type CreateExamAttemptInput = z.infer<typeof createExamAttemptSchema>;
