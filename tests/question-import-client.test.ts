import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canConfirmImport,
  confirmImport,
  createImportKey,
  getUtf8ByteLength,
  loadSubjects,
  MAX_IMPORT_BYTES,
  QuestionImportClientError,
  shouldPollImport,
  shouldRenderCancel,
  validateImport,
  type JobResult,
} from "../src/lib/api/question-import-client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const response = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  text: async () => JSON.stringify(body),
});

const job: JobResult = {
  jobId: "job-1",
  confirmToken: "token",
  status: "ready",
  summary: { totalItems: 1, validItems: 1, invalidItems: 0, duplicateItems: 0, skippedItems: 0, canConfirm: true },
  items: [],
};

afterEach(() => fetchMock.mockReset());

describe("question import frontend client", () => {
  it("handles JSON success and forwards AbortSignal", async () => {
    fetchMock.mockResolvedValue(response({ success: true, data: [{ _id: "subject-1" }] }));
    const controller = new AbortController();
    await expect(loadSubjects(controller.signal)).resolves.toEqual([{ _id: "subject-1" }]);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("preserves backend error code, message and details", async () => {
    fetchMock.mockResolvedValue(response({ success: false, error: { code: "IMPORT_INVALID", message: "Invalid import", details: { issues: [{ code: "BAD" }] } } }, { ok: false, status: 422 }));
    await expect(loadSubjects()).rejects.toMatchObject({ code: "IMPORT_INVALID", message: "Invalid import", details: { issues: [{ code: "BAD" }] }, status: 422 });
  });

  it("reports non-JSON responses without throwing a JSON parse error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, text: async () => "Bad Gateway" });
    await expect(loadSubjects()).rejects.toBeInstanceOf(QuestionImportClientError);
    await expect(loadSubjects()).rejects.toMatchObject({ message: "Server returned a non-JSON response (502).", status: 502 });
  });

  it("sends the validate payload and keeps confirm limited to the token", async () => {
    fetchMock.mockResolvedValueOnce(response({ success: true, data: job })).mockResolvedValueOnce(response({ success: true, data: { ...job, status: "completed", confirmToken: undefined } }));
    const input = { subjectId: "507f1f77bcf86cd799439011", targetExamSetIds: [], inputFormat: "json" as const, content: "[]", options: { duplicatePolicy: "reject" as const, defaultStatus: "draft" as const, defaultTranslationStatus: "not_required" as const } };
    await validateImport(input);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
    await confirmImport(job.jobId, job.confirmToken as string);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ confirmToken: "token" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("questions");
  });

  it("uses UTF-8 bytes for the five MB client limit", () => {
    expect(getUtf8ByteLength("😀")).toBe(4);
    expect(getUtf8ByteLength("a".repeat(MAX_IMPORT_BYTES + 1))).toBeGreaterThan(MAX_IMPORT_BYTES);
  });

  it("marks a changed configuration stale through the import key", () => {
    const options = { duplicatePolicy: "reject" as const, defaultStatus: "draft" as const, defaultTranslationStatus: "not_required" as const };
    expect(createImportKey("subject", [], "json", "one", options)).not.toBe(createImportKey("subject", [], "json", "two", options));
  });

  it("only renders cancel for cancellable statuses", () => {
    expect(shouldRenderCancel("ready")).toBe(true);
    expect(shouldRenderCancel("failed")).toBe(true);
    expect(shouldRenderCancel("importing")).toBe(false);
    expect(shouldRenderCancel("completed")).toBe(false);
  });

  it("polls only importing jobs and stops for terminal jobs", () => {
    expect(shouldPollImport("importing")).toBe(true);
    expect(shouldPollImport("completed")).toBe(false);
    expect(shouldPollImport("failed")).toBe(false);
    expect(shouldPollImport("cancelled")).toBe(false);
  });

  it("prevents duplicate confirm requests when stale or already confirming", () => {
    expect(canConfirmImport(job, false, false)).toBe(true);
    expect(canConfirmImport(job, true, false)).toBe(false);
    expect(canConfirmImport(job, false, true)).toBe(false);
    expect(canConfirmImport({ ...job, status: "completed" }, false, false)).toBe(false);
  });
});
