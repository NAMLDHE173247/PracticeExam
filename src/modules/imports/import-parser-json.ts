import type { QuestionImportIssue, QuestionImportInput } from "./question-import.types";

const text = (value: unknown, vi?: unknown) => typeof value === "string" ? { original: value, ...(typeof vi === "string" ? { vi } : {}) } : value && typeof value === "object" ? value : undefined;
const stableId = (value: unknown, index: number) => typeof value === "string" && value.trim() ? value.trim() : `option-${index + 1}`;

function normalizeItem(item: unknown): QuestionImportInput | undefined {
  if (!item || typeof item !== "object") return undefined;
  const value = item as Record<string, unknown>;
  const content = text(value.content, value.contentVi);
  const options = Array.isArray(value.options) ? value.options.map((raw, index) => { const option = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; return { id: stableId(option.id ?? option.label, index), label: typeof option.label === "string" ? option.label : stableId(option.id, index), content: text(option.content, option.text) ?? { original: "" }, ...("isCorrect" in option ? { isCorrect: option.isCorrect } : {}) }; }) : undefined;
  const statements = Array.isArray(value.statements) ? value.statements.map((raw, index) => { const statement = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; return { id: stableId(statement.id, index), content: text(statement.content, statement.text) ?? { original: "" }, answer: statement.answer ?? statement.isCorrect }; }) : undefined;
  return { type: value.type, content, options, statements, explanation: text(value.explanation, value.explanationVi), difficulty: value.difficulty, tags: value.tags, status: value.status, translationStatus: value.translationStatus } as QuestionImportInput;
}

export interface ParsedImportItem { itemIndex: number; raw?: unknown; normalizedQuestion?: QuestionImportInput; parseIssues: QuestionImportIssue[]; }

export function parseJsonImport(content: string): { items: ParsedImportItem[]; rootIssue?: QuestionImportIssue } {
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { return { items: [], rootIssue: { code: "INVALID_JSON", message: "JSON không hợp lệ.", severity: "error" } }; }
  const values: unknown[] | undefined = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).questions) ? (parsed as Record<string, unknown>).questions as unknown[] : undefined;
  if (!values) return { items: [], rootIssue: { code: "INVALID_ROOT_FORMAT", message: "JSON phải là mảng câu hỏi hoặc wrapper questions.", severity: "error" } };
  return { items: values.map((raw, itemIndex) => ({ itemIndex, raw, normalizedQuestion: normalizeItem(raw), parseIssues: normalizeItem(raw) ? [] : [{ itemIndex, code: "INVALID_TYPE", message: "Item phải là object.", severity: "error" }] })) };
}
