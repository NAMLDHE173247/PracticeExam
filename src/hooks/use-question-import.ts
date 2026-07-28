"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cancelImport, canConfirmImport, confirmImport, createImportKey, getImportJob, getUtf8ByteLength, loadExamSets, loadSubjects, MAX_IMPORT_BYTES, QuestionImportClientError, shouldPollImport, shouldRenderCancel, validateImport, type DuplicatePolicy, type ExamSet, type ImportFormat, type ImportOptions, type JobResult, type PreviewIssue, type Subject } from "@/lib/api/question-import-client";

const JOB_STORAGE_KEY = "practice-exam:question-import-job";
type ErrorState = { message: string; code?: string; details?: unknown; issues?: PreviewIssue[] } | null;

export function useQuestionImport() {
  const [subjects, setSubjects] = useState<Subject[]>([]); const [examSets, setExamSets] = useState<ExamSet[]>([]); const [subjectId, setSubjectId] = useState(""); const [examSetIds, setExamSetIds] = useState<string[]>([]);
  const [format, setFormat] = useState<ImportFormat>("json"); const [content, setContent] = useState(""); const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>("reject"); const [defaultStatus, setDefaultStatus] = useState<"draft" | "published">("draft"); const [defaultDifficulty, setDefaultDifficulty] = useState<ImportOptions["defaultDifficulty"]>(); const [defaultTranslationStatus, setDefaultTranslationStatus] = useState<ImportOptions["defaultTranslationStatus"]>("not_required");
  const [job, setJob] = useState<JobResult | null>(null); const [validatedKey, setValidatedKey] = useState(""); const [filter, setFilter] = useState("all"); const [isLoadingSubjects, setIsLoadingSubjects] = useState(true); const [isLoadingExamSets, setIsLoadingExamSets] = useState(false); const [isValidating, setIsValidating] = useState(false); const [isConfirming, setIsConfirming] = useState(false); const [isCancelling, setIsCancelling] = useState(false); const [loadError, setLoadError] = useState<ErrorState>(null); const [actionError, setActionError] = useState<ErrorState>(null); const [restoreMessage, setRestoreMessage] = useState(""); const [copyMessage, setCopyMessage] = useState("");
  const examSetRequestId = useRef(0);
  const options: ImportOptions = { duplicatePolicy, defaultStatus, ...(defaultDifficulty ? { defaultDifficulty } : {}), defaultTranslationStatus };
  const configKey = createImportKey(subjectId, examSetIds, format, content, options); const isStale = Boolean(job && (!validatedKey || validatedKey !== configKey)); const utf8Bytes = getUtf8ByteLength(content); const overLimit = utf8Bytes > MAX_IMPORT_BYTES;

  const toError = (reason: unknown): ErrorState => { if (reason instanceof QuestionImportClientError) return { message: reason.message, code: reason.code, details: reason.details, issues: (reason.details as { issues?: PreviewIssue[] } | undefined)?.issues }; return { message: reason instanceof Error ? reason.message : "An unexpected error occurred." }; };

  useEffect(() => {
    const controller = new AbortController();
    async function load() { try { const active = (await loadSubjects(controller.signal)).filter((item) => item.isActive); setSubjects(active); if (active[0]) setSubjectId(active[0]._id); } catch (reason: unknown) { if (!controller.signal.aborted) setLoadError(toError(reason)); } finally { if (!controller.signal.aborted) setIsLoadingSubjects(false); } }
    void load(); return () => controller.abort();
  }, []);

  useEffect(() => {
    const requestId = ++examSetRequestId.current; const controller = new AbortController();
    async function load() { if (!subjectId) { setExamSets([]); setExamSetIds([]); setIsLoadingExamSets(false); return; } setIsLoadingExamSets(true); try { const items = await loadExamSets(subjectId, controller.signal); if (requestId === examSetRequestId.current) setExamSets(items.filter((item) => item.status !== "archived")); } catch (reason: unknown) { if (!controller.signal.aborted && requestId === examSetRequestId.current) setLoadError(toError(reason)); } finally { if (!controller.signal.aborted && requestId === examSetRequestId.current) setIsLoadingExamSets(false); } }
    void load(); return () => controller.abort();
  }, [subjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return; const storedJobId = window.sessionStorage.getItem(JOB_STORAGE_KEY); if (!storedJobId) return; let active = true;
    void getImportJob(storedJobId).then((restored) => { if (!active) return; setJob(restored); setRestoreMessage(restored.status === "ready" ? "This ready job was restored without its confirm token. Validate the content again before confirming." : "Import job restored from this session."); }).catch(() => { window.sessionStorage.removeItem(JOB_STORAGE_KEY); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!job || !shouldPollImport(job.status)) return; let active = true; let timeout: number | undefined;
    const poll = async () => { try { const latest = await getImportJob(job.jobId); if (!active) return; setJob(latest); if (latest.status === "importing") timeout = window.setTimeout(() => void poll(), 1500); } catch (reason: unknown) { if (active) setActionError(toError(reason)); } };
    void poll(); return () => { active = false; if (timeout) window.clearTimeout(timeout); };
  }, [job]);

  const setSubject = (next: string) => { setSubjectId(next); setExamSetIds([]); setExamSets([]); setLoadError(null); };
  const changeFormat = (next: ImportFormat) => { if (content.trim() && next !== format) setActionError({ message: "You changed the format while content is present. Your content was not removed, but it may not match the new format." }); setFormat(next); };
  const setContentValue = (next: string) => setContent(next);
  const currentOptions = options;
  const validate = async () => { if (!subjectId || isValidating || overLimit || !content.trim()) return; setActionError(null); setIsValidating(true); try { const result = await validateImport({ subjectId, targetExamSetIds: examSetIds, inputFormat: format, content, options: currentOptions }); setJob(result); setValidatedKey(configKey); setFilter("all"); if (typeof window !== "undefined") window.sessionStorage.setItem(JOB_STORAGE_KEY, result.jobId); } catch (reason: unknown) { setActionError(toError(reason)); } finally { setIsValidating(false); } };
  const confirm = async () => { if (!job || !canConfirmImport(job, isStale, isConfirming)) return; setActionError(null); setIsConfirming(true); try { setJob(await confirmImport(job.jobId, job.confirmToken as string)); } catch (reason: unknown) { setActionError(toError(reason)); } finally { setIsConfirming(false); } };
  const refreshJob = async () => { if (!job?.jobId) return; try { setJob(await getImportJob(job.jobId)); } catch (reason: unknown) { setActionError(toError(reason)); } };
  const cancel = async () => { if (!job?.jobId || isCancelling || !shouldRenderCancel(job.status)) return; setActionError(null); setIsCancelling(true); try { setJob(await cancelImport(job.jobId)); } catch (reason: unknown) { setActionError(toError(reason)); } finally { setIsCancelling(false); } };
  const copySample = async (sample: string) => { try { await navigator.clipboard.writeText(sample); setCopyMessage("Sample copied."); } catch { setCopyMessage("Copy is unavailable in this browser."); } window.setTimeout(() => setCopyMessage(""), 2500); };
  const startNewImport = () => { if (typeof window !== "undefined") window.sessionStorage.removeItem(JOB_STORAGE_KEY); setJob(null); setValidatedKey(""); setContent(""); setActionError(null); setRestoreMessage(""); };
  const clearActionError = () => setActionError(null);
  const filteredItems = useMemo(() => (job?.items ?? []).filter((item) => filter === "all" || (filter === "duplicate" ? ["duplicate_in_batch", "duplicate_in_database"].includes(item.status) : item.status === filter)), [filter, job]);
  return { subjects, examSets, subjectId, examSetIds, format, content, duplicatePolicy, defaultStatus, defaultDifficulty, defaultTranslationStatus, job, filter, filteredItems, isStale, utf8Bytes, overLimit, isLoadingSubjects, isLoadingExamSets, isValidating, isConfirming, isCancelling, loadError, actionError, restoreMessage, copyMessage, setSubject, setExamSetIds, changeFormat, setContent: setContentValue, setDuplicatePolicy, setDefaultStatus, setDefaultDifficulty, setDefaultTranslationStatus, setFilter, validate, confirm, cancel, refreshJob, copySample, startNewImport, clearActionError };
}
