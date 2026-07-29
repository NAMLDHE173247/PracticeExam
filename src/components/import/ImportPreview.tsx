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
  ready: "Sẵn sàng",
  importing: "Đang tải",
  completed: "Hoàn tất",
  failed: "Lỗi",
  cancelled: "Đã hủy",
  valid: "Hợp lệ",
  invalid: "Không hợp lệ",
  duplicate_in_batch: "Trùng lặp trong tệp",
  duplicate_in_database: "Trùng lặp trong CSDL",
  skipped: "Đã bỏ qua",
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
          <p className="eyebrow">Bước 3</p>
          <h2 ref={headingRef} tabIndex={-1}>Xem trước</h2>
        </div>
        {props.isStale && <span className="stale-badge">Xem trước đã cũ — vui lòng xác thực lại</span>}
      </div>
      <div className="import-summary" aria-label="Tóm tắt tải lên">
        {[
          ["Tổng số", props.job.summary.totalItems],
          ["Hợp lệ", props.job.summary.validItems],
          ["Lỗi", props.job.summary.invalidItems],
          ["Trùng", props.job.summary.duplicateItems],
          ["Bỏ qua", props.job.summary.skippedItems],
        ].map(([label, value]) => (
          <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>
      <p className="preview-note" aria-live="polite">
        {props.job.summary.canConfirm && !props.isStale
          ? "Sẵn sàng xác nhận nhập dữ liệu."
          : props.isStale
            ? "Có thay đổi mới. Vui lòng xác thực lại."
            : "Không thể tải lên cho đến khi bạn sửa các lỗi hiện tại."}
      </p>
      <div className="preview-filters" role="group" aria-label="Bộ lọc">
        {[["all", "Tất cả"], ["valid", "Hợp lệ"], ["invalid", "Lỗi"], ["duplicate", "Trùng lặp"], ["skipped", "Bỏ qua"]].map(([value, label]) => (
          <button key={value} type="button" className={props.filter === value ? "selected" : ""} onClick={() => props.setFilter(value)}>{label}</button>
        ))}
      </div>
      <div className="preview-list">
        {props.items.map((item) => (
          <details className={`preview-item ${item.status}`} key={item.itemIndex} open={item.status === "invalid"}>
            <summary className="preview-item-top">
              <strong>Câu hỏi {item.questionNumber ?? item.itemIndex + 1}</strong>
              <span className="preview-item-status">{friendlyStatus(item.status)}</span>
            </summary>
            <p>{item.preview?.content?.original ?? "Không có nội dung câu hỏi"}</p>
            <div className="preview-item-meta">
              <span>{friendlyStatus(item.preview?.type ?? "unknown")}</span>
              {item.preview?.optionCount !== undefined && <span>{item.preview.optionCount} lựa chọn</span>}
              {item.preview?.statementCount !== undefined && <span>{item.preview.statementCount} phát biểu</span>}
              {item.preview?.difficulty && <span>{item.preview.difficulty}</span>}
              {item.preview?.tags?.map((tag) => <span key={tag}>#{tag}</span>)}
              {item.duplicateQuestionId && <span>Trùng với: {item.duplicateQuestionId}</span>}
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
      {props.items.length === 0 && <p className="empty-state">Không có mục nào khớp với bộ lọc.</p>}
      <div className="import-actions import-actions-bottom">
        {["ready", "failed"].includes(props.job.status) && (
          <button type="button" className="cancel-button" disabled={props.isCancelling} onClick={props.cancel}>
            {props.isCancelling ? "Đang hủy..." : "Hủy tải lên"}
          </button>
        )}
        <button type="button" className="add-button" disabled={props.isConfirming || props.isStale || props.job.status !== "ready" || !props.job.confirmToken || !props.job.summary.canConfirm} onClick={props.confirm}>
          {props.isConfirming ? "Đang nhập..." : "Xác nhận nhập"}
        </button>
        {props.job.status === "importing" && <button type="button" className="text-button" onClick={props.refresh}>Làm mới</button>}
      </div>
    </section>
  );
}
