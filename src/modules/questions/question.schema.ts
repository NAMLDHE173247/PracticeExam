import { ObjectId } from "mongodb";
import { z } from "zod";

const localizedTextSchema = z.object({
  original: z.string().trim().min(1),
  vi: z.string().trim().min(1).optional(),
});

const objectIdSchema = z.string().refine((value) => ObjectId.isValid(value), "Invalid ObjectId");

const tagsSchema = z.array(z.string().transform((value) => value.trim())).transform((tags) => {
  const uniqueTags = new Map<string, string>();
  for (const tag of tags) {
    if (tag && !uniqueTags.has(tag.toLowerCase())) uniqueTags.set(tag.toLowerCase(), tag);
  }
  return [...uniqueTags.values()];
});

const baseQuestionSchema = z.object({
  subjectId: objectIdSchema,
  examSetIds: z.array(objectIdSchema).default([]),
  content: localizedTextSchema,
  explanation: localizedTextSchema.optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: tagsSchema.default([]),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  contentHash: z.string().trim().min(1),
  source: z.object({ name: z.string().trim().min(1).optional(), externalId: z.string().trim().min(1).optional() }).optional(),
  translationStatus: z.enum(["original_only", "translated", "reviewed"]).optional(),
});

const optionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  content: localizedTextSchema,
  isCorrect: z.boolean(),
});

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;
const uniqueLabels = (labels: string[]) => new Set(labels.map((label) => label.trim().toLowerCase())).size === labels.length;

export const singleChoiceSchema = baseQuestionSchema.extend({
  type: z.literal("single_choice"),
  options: z.array(optionSchema).min(2).max(8),
}).superRefine((value, context) => {
  if (!uniqueIds(value.options.map((option) => option.id))) {
    context.addIssue({ code: "custom", path: ["options"], message: "Option ids must be unique" });
  }
  if (!uniqueLabels(value.options.map((option) => option.label))) {
    context.addIssue({ code: "custom", path: ["options"], message: "Option labels must be unique" });
  }
  if (value.options.filter((option) => option.isCorrect).length !== 1) {
    context.addIssue({ code: "custom", path: ["options"], message: "Single choice requires exactly one correct option" });
  }
});

export const multipleChoiceSchema = baseQuestionSchema.extend({
  type: z.literal("multiple_choice"),
  options: z.array(optionSchema).min(2).max(8),
}).superRefine((value, context) => {
  if (!uniqueIds(value.options.map((option) => option.id))) {
    context.addIssue({ code: "custom", path: ["options"], message: "Option ids must be unique" });
  }
  if (!uniqueLabels(value.options.map((option) => option.label))) {
    context.addIssue({ code: "custom", path: ["options"], message: "Option labels must be unique" });
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
  statements: z.array(statementSchema).min(1).max(10),
  options: z.never().optional(),
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
