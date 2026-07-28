import Link from "next/link";
import type { JobResult } from "@/lib/api/question-import-client";

type Props = { job: JobResult; startNewImport: () => void };

export function ImportResult({ job, startNewImport }: Props) {
  return (
    <section className="import-result" role="status">
      <div>
        <p className="eyebrow">Step 4</p>
        <h2>Import completed</h2>
        <p>{job.summary.importedItems ?? 0} questions were imported successfully.</p>
      </div>
      <div className="result-actions">
        <Link className="cancel-button" href="/#question-sets">Back to question bank</Link>
        <button className="add-button" type="button" onClick={startNewImport}>Start new import</button>
      </div>
      {job.createdQuestionIds && <p className="result-ids">Created question IDs: {job.createdQuestionIds.join(", ")}</p>}
    </section>
  );
}
