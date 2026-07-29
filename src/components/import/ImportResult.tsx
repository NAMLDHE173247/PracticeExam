import Link from "next/link";
import type { JobResult } from "@/lib/api/question-import-client";

type Props = { job: JobResult; startNewImport: () => void };

export function ImportResult({ job, startNewImport }: Props) {
  return (
    <section className="import-result" role="status">
      <div>
        <p className="eyebrow">Bước 4</p>
        <h2>Tải lên hoàn tất</h2>
        <p>{job.summary.importedItems ?? 0} câu hỏi đã được tải lên thành công.</p>
      </div>
      <div className="result-actions">
        <Link className="cancel-button" href="/#question-sets">Quay lại danh sách câu hỏi</Link>
        <button className="add-button" type="button" onClick={startNewImport}>Bắt đầu tải lên mới</button>
      </div>
      {job.createdQuestionIds && <p className="result-ids">Mã câu hỏi đã tạo: {job.createdQuestionIds.join(", ")}</p>}
    </section>
  );
}
