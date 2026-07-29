import { requestJson } from "./request";
import type { SerializedExamResult } from "../../modules/exam-results/exam-result.types";

export type { SerializedExamResult } from "../../modules/exam-results/exam-result.types";
export type { SerializedExamResultQuestion } from "../../modules/exam-results/exam-result.types";

export function getExamResult(
  attemptId: string,
  userId: string,
  signal?: AbortSignal
): Promise<SerializedExamResult> {
  return requestJson<SerializedExamResult>(
    `/api/results/${encodeURIComponent(attemptId)}?userId=${encodeURIComponent(userId)}`,
    { signal }
  );
}
