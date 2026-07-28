export type AttemptSettings = {
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showTranslation?: boolean;
  scoringMode?: "strict" | "partial";
};

export type AttemptQuestion = {
  questionId: string;
  order: number;
  type: "single_choice" | "multiple_choice" | "true_false_group";
  content: { original: string; vi?: string };
  options?: Array<{ id: string; label: string; content: { original: string; vi?: string } }>;
  statements?: Array<{ id: string; content: { original: string; vi?: string } }>;
};

export type AttemptAnswer = {
  questionId: string;
  selectedOptionIds?: string[];
  statementAnswers?: Array<{ statementId: string; answer: boolean }>;
  isFlagged: boolean;
  answeredAt?: string;
};

export type ExamAttempt = {
  id: string;
  mode: "exam_set" | "mixed";
  subjectId: string;
  examSetId?: string;
  status: "in_progress" | "submitting" | "submitted" | "expired" | "abandoned";
  startedAt: string;
  deadlineAt: string;
  secondsRemaining: number;
  mustSubmit: boolean;
  settings: Required<AttemptSettings>;
  questions: AttemptQuestion[];
  answers: AttemptAnswer[];
  score?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  partiallyCorrectCount?: number;
  submitReason?: "manual" | "timeout";
  submittedAt?: string;
};

export class ExamAttemptClientError extends Error {
  constructor(public readonly code: string | undefined, message: string, public readonly details?: unknown, public readonly status?: number) { super(message); }
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload: { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } };
  try { payload = text ? JSON.parse(text) as typeof payload : {}; } catch { throw new ExamAttemptClientError(undefined, `Server returned a non-JSON response (${response.status}).`, undefined, response.status); }
  if (!response.ok || !payload.success) {
    throw new ExamAttemptClientError(payload.error?.code, payload.error?.message ?? `Request failed (${response.status}).`, payload.error?.details, response.status);
  }
  return payload.data as T;
}

export type CreateAttemptInput =
  | { userId: string; mode: "exam_set"; examSetId: string; settings: AttemptSettings }
  | { userId: string; mode: "mixed"; subjectId: string; sourceExamSetIds: string[]; questionCount: number; durationMinutes: number; settings: AttemptSettings };

export function createExamAttempt(input: CreateAttemptInput, signal?: AbortSignal) {
  return requestJson<{ attempt: ExamAttempt }>("/api/exam-attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
}

export function getExamAttempt(attemptId: string, userId: string, signal?: AbortSignal) {
  return requestJson<{ attempt: ExamAttempt }>(`/api/exam-attempts/${encodeURIComponent(attemptId)}?userId=${encodeURIComponent(userId)}`, { signal });
}

export function saveExamAnswer(attemptId: string, input: { userId: string; questionId: string; selectedOptionIds?: string[]; statementAnswers?: Array<{ statementId: string; answer: boolean }>; isFlagged?: boolean }, signal?: AbortSignal) {
  return requestJson<{ questionId?: string; saved: boolean }>(`/api/exam-attempts/${encodeURIComponent(attemptId)}/answers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
}

export function submitExamAttempt(attemptId: string, userId: string, signal?: AbortSignal) {
  return requestJson<{ attempt: ExamAttempt }>(`/api/exam-attempts/${encodeURIComponent(attemptId)}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }), signal });
}
