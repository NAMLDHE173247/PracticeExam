import { requestJson } from "./request";
import type { AnalyticsResponse } from "../../modules/analytics/analytics.service";

export type { AnalyticsResponse, AnalyticsSummary, AnalyticsHistoryItem, AnalyticsFailedQuestion } from "../../modules/analytics/analytics.service";

export function getAnalytics(userId: string, subjectId?: string, signal?: AbortSignal) {
  const url = new URL("/api/analytics", window.location.origin);
  url.searchParams.set("userId", userId);
  if (subjectId) {
    url.searchParams.set("subjectId", subjectId);
  }
  return requestJson<AnalyticsResponse>(url.pathname + url.search, { signal });
}
