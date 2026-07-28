export type Subject = { _id: string; code: string; name: string; isActive: boolean };
export type ExamSet = { _id: string; title: string; subjectId: string; status: "draft" | "published" | "archived"; questionCount: number; durationMinutes?: number; passingScore?: number };
export type ImportFormat = "json" | "structured_text";
export type DuplicatePolicy = "reject" | "skip" | "allow";
export type PreviewIssue = { itemIndex?: number; questionNumber?: number; field?: string; code: string; message: string; severity: "error" | "warning" };
export type PreviewItem = { itemIndex: number; questionNumber?: number; status: string; contentHash?: string; duplicateQuestionId?: string; preview?: { type?: string; content?: { original?: string }; optionCount?: number; statementCount?: number; difficulty?: string; tags?: string[] }; issues: PreviewIssue[] };
export type Summary = { totalItems: number; validItems: number; invalidItems: number; duplicateItems: number; skippedItems: number; importedItems?: number; canConfirm?: boolean };
export type JobResult = { jobId: string; confirmToken?: string; status: string; summary: Summary; items: PreviewItem[]; createdQuestionIds?: string[] };
export type ImportOptions = { duplicatePolicy: DuplicatePolicy; defaultStatus: "draft" | "published"; defaultDifficulty?: "easy" | "medium" | "hard"; defaultTranslationStatus: "not_required" | "pending" | "translated" | "reviewed" | "failed" };

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export class QuestionImportClientError extends Error {
  constructor(public readonly code: string | undefined, message: string, public readonly details?: unknown, public readonly status?: number) { super(message); }
}

export function getUtf8ByteLength(value: string): number { return new TextEncoder().encode(value).byteLength; }
export function createImportKey(subjectId: string, examSetIds: string[], format: ImportFormat, content: string, options: ImportOptions): string { return JSON.stringify({ subjectId, examSetIds, format, content, options }); }
export function shouldRenderCancel(status: string): boolean { return status === "ready" || status === "failed"; }
export function shouldPollImport(status: string): boolean { return status === "importing"; }
export function canConfirmImport(job: Pick<JobResult, "status" | "confirmToken" | "summary"> | null, isStale: boolean, isConfirming: boolean): boolean { return Boolean(job && job.status === "ready" && job.confirmToken && job.summary.canConfirm && !isStale && !isConfirming); }

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload: { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } };
  try { payload = text ? JSON.parse(text) as typeof payload : {}; } catch { throw new QuestionImportClientError(undefined, `Server returned a non-JSON response (${response.status}).`, undefined, response.status); }
  if (!response.ok || !payload.success) { const error = payload.error; throw new QuestionImportClientError(error?.code, error?.message ?? `Request failed (${response.status}).`, error?.details, response.status); }
  return payload.data as T;
}

export const loadSubjects = (signal?: AbortSignal) => requestJson<Subject[]>("/api/subjects?pageSize=100", { signal });
export const loadExamSets = (subjectId: string, signal?: AbortSignal) => requestJson<ExamSet[]>(`/api/exam-sets?subjectId=${encodeURIComponent(subjectId)}&pageSize=100`, { signal });
export const validateImport = (input: { subjectId: string; targetExamSetIds: string[]; inputFormat: ImportFormat; content: string; options: ImportOptions }) => requestJson<JobResult>("/api/questions/import/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
export const getImportJob = (jobId: string) => requestJson<JobResult>(`/api/questions/import/${jobId}`);
export const confirmImport = (jobId: string, confirmToken: string) => requestJson<JobResult>(`/api/questions/import/${jobId}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmToken }) });
export const cancelImport = (jobId: string) => requestJson<JobResult>(`/api/questions/import/${jobId}/cancel`, { method: "POST" });
