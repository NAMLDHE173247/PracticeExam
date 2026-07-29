"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { ImportConfiguration } from "@/components/import/ImportConfiguration";
import { ImportEditor } from "@/components/import/ImportEditor";
import { ImportPreview } from "@/components/import/ImportPreview";
import { ImportResult } from "@/components/import/ImportResult";
import { jsonSample, structuredSample } from "@/components/import/import-samples";
import { MAX_IMPORT_BYTES } from "@/lib/api/question-import-client";
import { useQuestionImport } from "@/hooks/use-question-import";

export default function ImportQuestionsPage() {
  const {
    subjects, examSets, subjectId, examSetIds, format, content, duplicatePolicy,
    defaultStatus, defaultDifficulty, defaultTranslationStatus, job, filter, previewFocusKey,
    filteredItems, isStale, utf8Bytes, overLimit, isLoadingSubjects,
    isLoadingExamSets, isValidating, isConfirming, isCancelling, loadError,
    actionError, restoreMessage, copyMessage, setSubject, setExamSetIds, changeFormat, setContent,
    setDuplicatePolicy, setDefaultStatus, setDefaultDifficulty,
    setDefaultTranslationStatus, setFilter, validate, confirm, cancel,
    refreshJob, copySample, startNewImport,
  } = useQuestionImport();
  const error = actionError ?? loadError;
  const errorSummaryRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (error) window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
  }, [error]);
  const insertSample = () => setContent(format === "json" ? jsonSample : structuredSample);
  const clearContent = () => setContent("");

  return <SidebarLayout>
    <main className="import-page">
    <div className="import-page-header"><div><p className="eyebrow">Question bank</p><h1>Import Questions</h1><p className="page-description">Validate and safely add questions to your question bank.</p></div><Link className="import-back-link" href="/#question-sets">← Back to question sets</Link></div>
    <ol className="import-steps" aria-label="Import progress"><li className="active"><span>1</span>Configure</li><li className={job ? "active" : ""}><span>2</span>Preview</li><li className={job?.status === "completed" ? "active" : ""}><span>3</span>Result</li></ol>
    {restoreMessage && <p className="import-restore-note" role="status">{restoreMessage}</p>}
    {error && <section className="import-alert" role="alert" tabIndex={-1} ref={errorSummaryRef}><strong>{error.code ?? "IMPORT_ERROR"}</strong><span>{error.message}</span>{error.issues?.map((issue, index) => <span key={`${issue.code}-${index}`}>Question {issue.itemIndex !== undefined ? issue.itemIndex + 1 : "-"} · {issue.field ?? "general"} · {issue.code}: {issue.message}</span>)}</section>}
    <ImportConfiguration subjects={subjects} examSets={examSets} subjectId={subjectId} examSetIds={examSetIds} format={format} duplicatePolicy={duplicatePolicy} defaultStatus={defaultStatus} defaultDifficulty={defaultDifficulty} defaultTranslationStatus={defaultTranslationStatus} isLoadingSubjects={isLoadingSubjects} isLoadingExamSets={isLoadingExamSets} isConfirming={isConfirming} setSubject={setSubject} setExamSetIds={setExamSetIds} setFormat={changeFormat} setDuplicatePolicy={setDuplicatePolicy} setDefaultStatus={setDefaultStatus} setDefaultDifficulty={setDefaultDifficulty} setDefaultTranslationStatus={setDefaultTranslationStatus} />
    <ImportEditor format={format} content={content} utf8Bytes={utf8Bytes} overLimit={overLimit} isConfirming={isConfirming} isValidating={isValidating} copyMessage={copyMessage} setFormat={changeFormat} setContent={setContent} validate={() => void validate()} copySample={copySample} insertSample={insertSample} clearContent={clearContent} jsonSample={jsonSample} structuredSample={structuredSample} />
    {job && <ImportPreview job={job} focusKey={previewFocusKey} items={filteredItems} filter={filter} isStale={isStale} isConfirming={isConfirming} isCancelling={isCancelling} setFilter={setFilter} confirm={() => void confirm()} cancel={() => void cancel()} refresh={() => void refreshJob()} />}
    {job?.status === "completed" && !isStale && <ImportResult job={job} startNewImport={startNewImport} />}
    <p className="import-limit-note">Client limit: {(MAX_IMPORT_BYTES / (1024 * 1024)).toFixed(0)} MB UTF-8. Backend validation remains authoritative.</p>
  </main>
  </SidebarLayout>;
}
