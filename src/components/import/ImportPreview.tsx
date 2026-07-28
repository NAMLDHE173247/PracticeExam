import { useEffect, useRef } from "react";
import type { JobResult, PreviewItem } from "@/lib/api/question-import-client";

type Props = {
  job: JobResult;
  focusKey: number;
  items: PreviewItem[];
  filter: string;
  isStale: boolean;
  isConfirming: boolean;
  isCancelling: boolean;
  setFilter: (value: string) => void;
  confirm: () => void;
  cancel: () => void;
  refresh: () => void;
};

const statusLabels: Record<string, string> = {
  ready: "Ready",
  importing: "Importing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  valid: "Valid",
  invalid: "Invalid",
  duplicate_in_batch: "Duplicate in import",
  duplicate_in_database: "Duplicate in database",
  skipped: "Skipped",
};

const friendlyStatus = (status: string) => statusLabels[status] ?? status;

export function ImportPreview(props: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [props.focusKey]);

  return (
    <section className="import-preview-card">
      <div className="import-section-heading">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2 ref={headingRef} tabIndex={-1}>Preview</h2>
        </div>
        {props.isStale && <span className="stale-badge">Preview is stale — validate again</span>}
      </div>
      <div className="import-summary" aria-label="Import summary">
        {[
          ["Total", props.job.summary.totalItems],
          ["Valid", props.job.summary.validItems],
          ["Invalid", props.job.summary.invalidItems],
          ["Duplicate", props.job.summary.duplicateItems],
          ["Skipped", props.job.summary.skippedItems],
        ].map(([label, value]) => (
          <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>
      <p className="preview-note" aria-live="polite">
        {props.job.summary.canConfirm && !props.isStale
          ? "Ready to confirm this import."
          : props.isStale
            ? "Change detected. Validate again before confirming."
            : "This import cannot be confirmed until the issues are fixed."}
      </p>
      <div className="preview-filters" role="group" aria-label="Preview filters">
        {[["all", "All"], ["valid", "Valid"], ["invalid", "Invalid"], ["duplicate", "Duplicate"], ["skipped", "Skipped"]].map(([value, label]) => (
          <button key={value} type="button" className={props.filter === value ? "selected" : ""} onClick={() => props.setFilter(value)}>{label}</button>
        ))}
      </div>
      <div className="preview-list">
        {props.items.map((item) => (
          <details className={`preview-item ${item.status}`} key={item.itemIndex} open={item.status === "invalid"}>
            <summary className="preview-item-top">
              <strong>Question {item.questionNumber ?? item.itemIndex + 1}</strong>
              <span className="preview-item-status">{friendlyStatus(item.status)}</span>
            </summary>
            <p>{item.preview?.content?.original ?? "No question content"}</p>
            <div className="preview-item-meta">
              <span>{friendlyStatus(item.preview?.type ?? "unknown")}</span>
              {item.preview?.optionCount !== undefined && <span>{item.preview.optionCount} options</span>}
              {item.preview?.statementCount !== undefined && <span>{item.preview.statementCount} statements</span>}
              {item.preview?.difficulty && <span>{item.preview.difficulty}</span>}
              {item.preview?.tags?.map((tag) => <span key={tag}>#{tag}</span>)}
              {item.duplicateQuestionId && <span>Duplicate: {item.duplicateQuestionId}</span>}
            </div>
            {item.issues.length > 0 && (
              <ul className="preview-issues">
                {item.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}><strong>{issue.severity}</strong> {issue.code}: {issue.message}{issue.field ? ` (${issue.field})` : ""}</li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>
      {props.items.length === 0 && <p className="empty-state">No preview items match this filter.</p>}
      <div className="import-actions import-actions-bottom">
        {["ready", "failed"].includes(props.job.status) && (
          <button type="button" className="cancel-button" disabled={props.isCancelling} onClick={props.cancel}>
            {props.isCancelling ? "Cancelling…" : "Cancel job"}
          </button>
        )}
        <button type="button" className="add-button" disabled={props.isConfirming || props.isStale || props.job.status !== "ready" || !props.job.confirmToken || !props.job.summary.canConfirm} onClick={props.confirm}>
          {props.isConfirming ? "Importing…" : "Confirm import"}
        </button>
        {props.job.status === "importing" && <button type="button" className="text-button" onClick={props.refresh}>Refresh status</button>}
      </div>
    </section>
  );
}
