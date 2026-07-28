import { z } from "zod";

const localizedTextSchema = z.object({
  original: z.string().trim().min(1),
  vi: z.string().trim().min(1).optional(),
});

const baseQuestionSchema = z.object({
  subjectId: z.string().min(1),
  examSetIds: z.array(z.string().min(1)).default([]),
  content: localizedTextSchema,
  explanation: localizedTextSchema.optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  contentHash: z.string().trim().min(1),
});

const optionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  content: localizedTextSchema,
  isCorrect: z.boolean(),
});

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

export const singleChoiceSchema = baseQuestionSchema.extend({
  type: z.literal("single_choice"),
  options: z.array(optionSchema).min(2).max(7),
}).superRefine((value, context) => {
  if (!uniqueIds(value.options.map((option) => option.id))) {
    context.addIssue({ code: "custom", path: ["options"], message: "Option ids must be unique" });
  }
  if (value.options.filter((option) => option.isCorrect).length !== 1) {
    context.addIssue({ code: "custom", path: ["options"], message: "Single choice requires exactly one correct option" });
  }
});

export const multipleChoiceSchema = baseQuestionSchema.extend({
  type: z.literal("multiple_choice"),
  options: z.array(optionSchema).min(2).max(7),
}).superRefine((value, context) => {
  if (!uniqueIds(value.options.map((option) => option.id))) {
    context.addIssue({ code: "custom", path: ["options"], message: "Option ids must be unique" });
  }
  const correctCount = value.options.filter((option) => option.isCorrect).length;
  if (correctCount < 2 || correctCount === value.options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Multiple choice requires some, but not all, options to be correct" });
  }
});

const statementSchema = z.object({
  id: z.string().trim().min(1),
  content: localizedTextSchema,
  answer: z.boolean(),
});

export const trueFalseGroupSchema = baseQuestionSchema.extend({
  type: z.literal("true_false_group"),
  statements: z.array(statementSchema).min(1).max(20),
}).superRefine((value, context) => {
  if (!uniqueIds(value.statements.map((statement) => statement.id))) {
    context.addIssue({ code: "custom", path: ["statements"], message: "Statement ids must be unique" });
  }
});

export const questionSchema = z.discriminatedUnion("type", [
  singleChoiceSchema,
  multipleChoiceSchema,
  trueFalseGroupSchema,
]);

export type QuestionInput = z.infer<typeof questionSchema>;
