// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JOB_STORAGE_KEY, useQuestionImport } from "../src/hooks/use-question-import";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const subjectA = { _id: "subject-a", code: "A", name: "Subject A", isActive: true };
const subjectB = { _id: "subject-b", code: "B", name: "Subject B", isActive: true };
const examSetA = { _id: "set-a", title: "Set A", subjectId: "subject-a", status: "draft" as const, questionCount: 1 };
const examSetB = { _id: "set-b", title: "Set B", subjectId: "subject-b", status: "draft" as const, questionCount: 2 };

const jsonResponse = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 422, text: async () => JSON.stringify(ok ? { success: true, data } : { success: false, error: { code: "INVALID_IMPORT", message: "Invalid content" } }) });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

const readyJob = (status: string = "ready") => ({
  jobId: "job-1",
  confirmToken: "confirm-token",
  status,
  summary: { totalItems: 1, validItems: 1, invalidItems: 0, duplicateItems: 0, skippedItems: 0, canConfirm: true },
  items: [],
});

afterEach(() => {
  fetchMock.mockReset();
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe("useQuestionImport", () => {
  it("clears selected exam sets when the subject changes or is emptied", async () => {
    fetchMock.mockImplementation((url: string) => url.includes("subjects") ? Promise.resolve(jsonResponse([subjectA, subjectB])) : Promise.resolve(jsonResponse([examSetA])));
    const { result } = renderHook(() => useQuestionImport());
    await waitFor(() => expect(result.current.examSets).toEqual([examSetA]));
    act(() => result.current.setExamSetIds([examSetA._id]));
    act(() => result.current.setSubject(""));
    expect(result.current.examSets).toEqual([]);
    expect(result.current.examSetIds).toEqual([]);
  });

  it("does not let a stale subject request overwrite the latest request", async () => {
    const first = deferred<ReturnType<typeof jsonResponse>>();
    const second = deferred<ReturnType<typeof jsonResponse>>();
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("subjects")) return Promise.resolve(jsonResponse([subjectA, subjectB]));
      return url.includes("subject-a") ? first.promise : second.promise;
    });
    const { result } = renderHook(() => useQuestionImport());
    await waitFor(() => expect(result.current.subjectId).toBe(subjectA._id));
    act(() => result.current.setSubject(subjectB._id));
    second.resolve(jsonResponse([examSetB]));
    await waitFor(() => expect(result.current.examSets).toEqual([examSetB]));
    first.resolve(jsonResponse([examSetA]));
    await Promise.resolve();
    expect(result.current.examSets).toEqual([examSetB]);
  });

  it("keeps textarea content after validate API failure", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("subjects")) return Promise.resolve(jsonResponse([subjectA]));
      if (url.includes("exam-sets")) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse(null, false));
    });
    const { result } = renderHook(() => useQuestionImport());
    await waitFor(() => expect(result.current.subjectId).toBe(subjectA._id));
    act(() => result.current.setContent("important content"));
    await act(async () => { await result.current.validate(); });
    expect(result.current.content).toBe("important content");
    expect(result.current.actionError?.code).toBe("INVALID_IMPORT");
  });

  it("uses a 1.5 second polling cadence and stops after completed", async () => {
    window.sessionStorage.setItem(JOB_STORAGE_KEY, "job-1");
    const importing = readyJob("importing");
    const completed = readyJob("completed");
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("subjects")) return Promise.resolve(jsonResponse([subjectA]));
      if (url.includes("exam-sets")) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/questions/import/job-1")).length === 1 ? importing : completed));
    });
    const { result } = renderHook(() => useQuestionImport());
    await waitFor(() => expect(result.current.job?.status).toBe("importing"));
    const before = fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/questions/import/job-1")).length;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/questions/import/job-1")).length).toBe(before);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await waitFor(() => expect(result.current.job?.status).toBe("completed"));
    const completedCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/questions/import/job-1")).length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/questions/import/job-1")).length).toBe(completedCalls);
  });

  it("stops polling when the hook unmounts", async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(JOB_STORAGE_KEY, "job-1");
    fetchMock.mockImplementation((url: string) => url.includes("subjects") ? Promise.resolve(jsonResponse([subjectA])) : url.includes("exam-sets") ? Promise.resolve(jsonResponse([])) : Promise.resolve(jsonResponse(readyJob("importing"))));
    const hook = renderHook(() => useQuestionImport());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    hook.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/questions/import/job-1")).length).toBe(1);
  });

  it("allows only one confirm request for two immediate calls", async () => {
    const confirmRequest = deferred<ReturnType<typeof jsonResponse>>();
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("subjects")) return Promise.resolve(jsonResponse([subjectA]));
      if (url.includes("exam-sets")) return Promise.resolve(jsonResponse([]));
      if (url.endsWith("/validate")) return Promise.resolve(jsonResponse(readyJob()));
      if (url.endsWith("/confirm")) return confirmRequest.promise;
      return Promise.resolve(jsonResponse(readyJob()));
    });
    const { result } = renderHook(() => useQuestionImport());
    await waitFor(() => expect(result.current.subjectId).toBe(subjectA._id));
    act(() => result.current.setContent("valid content"));
    await act(async () => { await result.current.validate(); });
    await act(async () => { void result.current.confirm(); void result.current.confirm(); });
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/confirm")).length).toBe(1);
    confirmRequest.resolve(jsonResponse(readyJob("completed")));
    await act(async () => { await confirmRequest.promise; });
  });
});
