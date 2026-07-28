"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Subject = { _id: string; code: string; name: string; isActive: boolean };
type ExamSet = { _id: string; title: string; subjectId: string; status: "draft" | "published" | "archived"; questionCount: number };
type ImportFormat = "json" | "structured_text";
type DuplicatePolicy = "reject" | "skip" | "allow";
type PreviewIssue = { itemIndex?: number; questionNumber?: number; field?: string; code: string; message: string; severity: "error" | "warning" };
type PreviewItem = { itemIndex: number; questionNumber?: number; status: string; contentHash?: string; duplicateQuestionId?: string; preview?: { type?: string; content?: { original?: string }; optionCount?: number; statementCount?: number; difficulty?: string; tags?: string[] }; issues: PreviewIssue[] };
type Summary = { totalItems: number; validItems: number; invalidItems: number; duplicateItems: number; skippedItems: number; importedItems?: number; canConfirm?: boolean };
type JobResult = { jobId: string; confirmToken?: string; status: string; summary: Summary; items: PreviewItem[]; createdQuestionIds?: string[] };

const jsonSample = `[
  {
    "type": "single_choice",
    "content": { "original": "What does HTTP stand for?", "vi": "HTTP là viết tắt của gì?" },
    "options": [
      { "id": "A", "label": "A", "content": { "original": "HyperText Transfer Protocol" }, "isCorrect": true },
      { "id": "B", "label": "B", "content": { "original": "High Transfer Text Process" }, "isCorrect": false }
    ],
    "tags": ["web"],
    "status": "draft"
  },
  {
    "type": "multiple_choice",
    "content": { "original": "Which are web browsers?", "vi": "Đâu là trình duyệt web?" },
    "options": [
      { "id": "A", "label": "A", "content": { "original": "Firefox" }, "isCorrect": true },
      { "id": "B", "label": "B", "content": { "original": "Chrome" }, "isCorrect": true },
      { "id": "C", "label": "C", "content": { "original": "PostgreSQL" }, "isCorrect": false }
    ],
    "status": "draft"
  },
  {
    "type": "true_false_group",
    "content": { "original": "Mark each statement.", "vi": "Đánh dấu từng nhận định." },
    "statements": [
      { "id": "1", "content": { "original": "HTML is a markup language." }, "answer": true },
      { "id": "2", "content": { "original": "CSS is a database." }, "answer": false }
    ],
    "status": "draft"
  }
]`;

const structuredSample = `[QUESTION]
TYPE: single_choice
CONTENT: What does HTTP stand for?
CONTENT_VI: HTTP là viết tắt của gì?
A: HyperText Transfer Protocol
B: High Transfer Text Process
ANSWER: A
[/QUESTION]
[QUESTION]
TYPE: multiple_choice
CONTENT: Which are web browsers?
A: Firefox
B: Chrome
C: PostgreSQL
ANSWER: A,B
[/QUESTION]
[QUESTION]
TYPE: true_false_group
CONTENT: Mark each statement.
1: HTML is a markup language. | TRUE
2: CSS is a database. | FALSE
[/QUESTION]`;

function currentKey(subjectId: string, examSetIds: string[], format: ImportFormat, content: string, duplicatePolicy: DuplicatePolicy, defaultStatus: string, defaultDifficulty: string, defaultTranslationStatus: string) { return JSON.stringify({ subjectId, examSetIds, format, content, duplicatePolicy, defaultStatus, defaultDifficulty, defaultTranslationStatus }); }
function isDuplicate(status: string) { return status === "duplicate_in_batch" || status === "duplicate_in_database"; }

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options); const payload = await response.json() as { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: { issues?: PreviewIssue[] } } };
  if (!response.ok || !payload.success) { const error = new Error(payload.error?.message ?? "Request failed.") as Error & { code?: string; issues?: PreviewIssue[] }; error.code = payload.error?.code; error.issues = payload.error?.details?.issues; throw error; }
  return payload.data as T;
}

export default function ImportQuestionsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]); const [examSets, setExamSets] = useState<ExamSet[]>([]); const [subjectId, setSubjectId] = useState(""); const [examSetIds, setExamSetIds] = useState<string[]>([]);
  const [format, setFormat] = useState<ImportFormat>("json"); const [content, setContent] = useState(""); const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>("reject"); const [defaultStatus, setDefaultStatus] = useState("draft"); const [defaultDifficulty, setDefaultDifficulty] = useState(""); const [defaultTranslationStatus, setDefaultTranslationStatus] = useState("not_required");
  const [job, setJob] = useState<JobResult | null>(null); const [validatedKey, setValidatedKey] = useState(""); const [filter, setFilter] = useState("all"); const [isLoading, setIsLoading] = useState(true); const [isValidating, setIsValidating] = useState(false); const [isConfirming, setIsConfirming] = useState(false); const [isCancelling, setIsCancelling] = useState(false); const [error, setError] = useState<{ message: string; code?: string; issues?: PreviewIssue[] } | null>(null);

  const configKey = currentKey(subjectId, examSetIds, format, content, duplicatePolicy, defaultStatus, defaultDifficulty, defaultTranslationStatus); const isStale = Boolean(job && validatedKey !== configKey);

  useEffect(() => { void api<Subject[]>("/api/subjects?pageSize=100").then((items) => { const active = items.filter((item) => item.isActive); setSubjects(active); if (active[0]) setSubjectId(active[0]._id); }).catch((reason: unknown) => setError({ message: reason instanceof Error ? reason.message : "Không thể tải môn học." })).finally(() => setIsLoading(false)); }, []);
  useEffect(() => { if (!subjectId) return; void api<ExamSet[]>(`/api/exam-sets?subjectId=${encodeURIComponent(subjectId)}&pageSize=100`).then((items) => setExamSets(items.filter((item) => item.status !== "archived"))).catch((reason: unknown) => setError({ message: reason instanceof Error ? reason.message : "Không thể tải bộ đề." })); }, [subjectId]);

  const filteredItems = useMemo(() => (job?.items ?? []).filter((item) => filter === "all" || filter === "duplicate" ? filter === "all" || isDuplicate(item.status) : item.status === filter), [filter, job]);
  const setErrorFrom = (reason: unknown) => { const value = reason as Error & { code?: string; issues?: PreviewIssue[] }; setError({ message: value instanceof Error ? value.message : "Đã xảy ra lỗi.", code: value.code, issues: value.issues }); };
  function updateContent(next: string) { setContent(next); }
  function changeFormat(next: ImportFormat) { if (content.trim() && next !== format) setError({ message: "Bạn đang đổi định dạng khi nội dung hiện tại có thể không tương thích. Nội dung chưa bị xóa." }); setFormat(next); }
  function insertSample() { updateContent(format === "json" ? jsonSample : structuredSample); setError(null); }
  async function validate() { if (!subjectId || isValidating) return; setError(null); setIsValidating(true); try { const result = await api<JobResult>("/api/questions/import/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId, targetExamSetIds: examSetIds, inputFormat: format, content, options: { duplicatePolicy, defaultStatus, ...(defaultDifficulty ? { defaultDifficulty } : {}), defaultTranslationStatus } }) }); setJob(result); setValidatedKey(configKey); setFilter("all"); } catch (reason: unknown) { setErrorFrom(reason); } finally { setIsValidating(false); } }
  async function confirm() { if (!job?.jobId || !job.confirmToken || isStale || job.status !== "ready" || !job.summary.canConfirm || isConfirming) return; setError(null); setIsConfirming(true); try { setJob(await api<JobResult>(`/api/questions/import/${job.jobId}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmToken: job.confirmToken }) })); } catch (reason: unknown) { setErrorFrom(reason); if ((reason as { code?: string }).code === "IMPORT_ALREADY_RUNNING") await refreshJob(); } finally { setIsConfirming(false); } }
  async function refreshJob() { if (!job?.jobId) return; try { setJob(await api<JobResult>(`/api/questions/import/${job.jobId}`)); } catch (reason: unknown) { setErrorFrom(reason); } }
  async function cancel() { if (!job?.jobId || isCancelling || !["ready", "failed"].includes(job.status)) return; setIsCancelling(true); setError(null); try { setJob(await api<JobResult>(`/api/questions/import/${job.jobId}/cancel`, { method: "POST" })); } catch (reason: unknown) { setErrorFrom(reason); } finally { setIsCancelling(false); } }
  function toggleExamSet(id: string) { setExamSetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function changeSubject(next: string) { setSubjectId(next); setExamSetIds([]); setExamSets([]); }
  function newImport() { setJob(null); setValidatedKey(""); setContent(""); setError(null); }

  return <main className="import-page"><div className="import-page-header"><div><p className="eyebrow">Question bank</p><h1>Import Questions</h1><p className="page-description">Validate and safely add questions to your question bank.</p></div><Link className="import-back-link" href="/#question-sets">← Back to question sets</Link></div>
    <ol className="import-steps" aria-label="Import progress"><li className="active"><span>1</span>Configure</li><li className={job ? "active" : ""}><span>2</span>Preview</li><li className={job?.status === "completed" ? "active" : ""}><span>3</span>Result</li></ol>
    {error && <section className="import-alert" role="alert"><strong>{error.code ?? "IMPORT_ERROR"}</strong><span>{error.message}</span>{error.issues?.map((issue, index) => <span key={`${issue.code}-${index}`}>Question {issue.itemIndex !== undefined ? issue.itemIndex + 1 : "-"} · {issue.field ?? "general"} · {issue.code}: {issue.message}</span>)}</section>}
    <section className="import-config-card"><div className="import-section-heading"><div><p className="eyebrow">Step 1</p><h2>Import configuration</h2></div><span className="import-status" aria-live="polite">{job?.status ?? "Not validated"}</span></div><div className="import-form-grid">
      <label>Subject<select value={subjectId} disabled={isLoading || isConfirming} onChange={(event) => changeSubject(event.target.value)}><option value="">Select a subject</option>{subjects.map((item) => <option key={item._id} value={item._id}>{item.code} — {item.name}</option>)}</select></label>
      <fieldset><legend>Target exam sets <small>optional</small></legend><div className="exam-set-options">{examSets.length ? examSets.map((item) => <label className="check-option" key={item._id}><input type="checkbox" checked={examSetIds.includes(item._id)} disabled={isConfirming} onChange={() => toggleExamSet(item._id)} /><span>{item.title}</span><small>{item.questionCount} questions · {item.status}</small></label>) : <p className="field-hint">{subjectId ? "No active exam sets. The questions will be stored in the shared bank." : "Select a subject first."}</p>}</div></fieldset>
      <label>Input format<select value={format} disabled={isConfirming} onChange={(event) => changeFormat(event.target.value as ImportFormat)}><option value="json">JSON</option><option value="structured_text">Structured text</option></select></label>
      <label>Duplicate policy<select value={duplicatePolicy} disabled={isConfirming} onChange={(event) => setDuplicatePolicy(event.target.value as DuplicatePolicy)}><option value="reject">Reject duplicates</option><option value="skip">Skip duplicates</option><option value="allow">Allow duplicates</option></select></label>
      <label>Default status<select value={defaultStatus} disabled={isConfirming} onChange={(event) => setDefaultStatus(event.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label>
      <label>Default difficulty<select value={defaultDifficulty} disabled={isConfirming} onChange={(event) => setDefaultDifficulty(event.target.value)}><option value="">Not set</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
      <label>Default translation status<select value={defaultTranslationStatus} disabled={isConfirming} onChange={(event) => setDefaultTranslationStatus(event.target.value)}><option value="not_required">Not required</option><option value="pending">Pending</option><option value="translated">Translated</option><option value="reviewed">Reviewed</option><option value="failed">Failed</option></select></label>
    </div></section>
    <section className="import-editor-card"><div className="import-section-heading"><div><p className="eyebrow">Step 2</p><h2>Input data</h2></div><div className="editor-actions"><button type="button" className="text-button" onClick={insertSample}>Insert {format === "json" ? "JSON" : "structured text"} sample</button><button type="button" className="text-button" onClick={() => navigator.clipboard?.writeText(format === "json" ? jsonSample : structuredSample)}>Copy sample</button><button type="button" className="text-button" onClick={() => updateContent("")}>Clear</button></div></div><div className="editor-layout"><div><textarea aria-label="Import content" value={content} disabled={isConfirming} onChange={(event) => updateContent(event.target.value)} placeholder={format === "json" ? "Paste a JSON array or { questions: [] } here..." : "Paste [QUESTION] blocks here..."} /><div className="editor-meta"><span>{content.length.toLocaleString()} characters</span><span>Maximum 5 MB</span></div></div><aside className="format-help"><h3>{format === "json" ? "JSON format" : "Structured text format"}</h3>{format === "json" ? <pre>{jsonSample}</pre> : <><pre>{structuredSample}</pre><p>Use 2–8 options. Multiple choice needs at least 2, but not all, correct answers. True/false accepts TRUE, FALSE, ĐÚNG, SAI, T or F.</p></>}</aside></div><div className="import-actions"><button className="add-button" type="button" disabled={isValidating || !subjectId || !content.trim()} onClick={() => void validate()}>{isValidating ? "Validating…" : "Validate and preview"}</button></div></section>
    {job && <section className="import-preview-card"><div className="import-section-heading"><div><p className="eyebrow">Step 3</p><h2>Preview</h2></div>{isStale && <span className="stale-badge">Preview is stale — validate again</span>}</div><div className="import-summary" aria-label="Import summary">{[["Total", job.summary.totalItems], ["Valid", job.summary.validItems], ["Invalid", job.summary.invalidItems], ["Duplicate", job.summary.duplicateItems], ["Skipped", job.summary.skippedItems]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p className="preview-note">{job.summary.canConfirm && !isStale ? "Ready to confirm this import." : isStale ? "Change detected. Validate again before confirming." : "This import cannot be confirmed until the issues are fixed."}</p><div className="preview-filters" role="group" aria-label="Preview filters">{[["all", "All"], ["valid", "Valid"], ["invalid", "Invalid"], ["duplicate", "Duplicate"], ["skipped", "Skipped"]].map(([value, label]) => <button key={value} type="button" className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="preview-list">{filteredItems.map((item) => <article className={`preview-item ${item.status}`} key={item.itemIndex}><div className="preview-item-top"><strong>Question {item.questionNumber ?? item.itemIndex + 1}</strong><span className="preview-item-status">{item.status}</span></div><p>{item.preview?.content?.original ?? "No question content"}</p><div className="preview-item-meta"><span>{item.preview?.type ?? "unknown"}</span>{item.preview?.optionCount !== undefined && <span>{item.preview.optionCount} options</span>}{item.preview?.statementCount !== undefined && <span>{item.preview.statementCount} statements</span>}{item.preview?.difficulty && <span>{item.preview.difficulty}</span>}{item.preview?.tags?.map((tag) => <span key={tag}>#{tag}</span>)}{item.duplicateQuestionId && <span>Duplicate: {item.duplicateQuestionId}</span>}</div>{item.issues.length > 0 && <ul className="preview-issues">{item.issues.map((issue, index) => <li key={`${issue.code}-${index}`}><strong>{issue.severity}</strong> {issue.code}: {issue.message}{issue.field ? ` (${issue.field})` : ""}</li>)}</ul>}</article>)}</div>{filteredItems.length === 0 && <p className="empty-state">No preview items match this filter.</p>}<div className="import-actions import-actions-bottom"><button type="button" className="cancel-button" disabled={isCancelling || !["ready", "failed"].includes(job.status)} onClick={() => void cancel()}>{isCancelling ? "Cancelling…" : "Cancel job"}</button><button type="button" className="add-button" disabled={isConfirming || isStale || job.status !== "ready" || !job.confirmToken || !job.summary.canConfirm} onClick={() => void confirm()}>{isConfirming ? "Importing…" : "Confirm import"}</button>{job.status === "importing" && <button type="button" className="text-button" onClick={() => void refreshJob()}>Refresh status</button>}</div></section>}
    {job?.status === "completed" && !isStale && <section className="import-result" role="status"><div><p className="eyebrow">Step 4</p><h2>Import completed</h2><p>{job.summary.importedItems ?? 0} questions were imported successfully.</p></div><div className="result-actions"><Link className="cancel-button" href="/#question-sets">Back to question bank</Link><button className="add-button" type="button" onClick={newImport}>Start new import</button></div>{job.createdQuestionIds && <p className="result-ids">Created question IDs: {job.createdQuestionIds.join(", ")}</p>}</section>}
  </main>;
}
