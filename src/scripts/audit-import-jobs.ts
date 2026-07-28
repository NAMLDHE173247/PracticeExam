import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { getCollection } = await import("../lib/mongodb");
  const jobs = await getCollection("question_import_jobs"); const issues: Array<Record<string, unknown>> = [];
  for await (const job of jobs.find({})) {
    const preview = job.previewItems; const valid = preview.filter((item) => item.status === "valid").length; const invalid = preview.filter((item) => item.status === "invalid").length; const duplicates = preview.filter((item) => item.status === "duplicate_in_batch" || item.status === "duplicate_in_database").length;
    if (job.status === "importing" || (job.status === "completed" && job.createdQuestionIds.length !== job.importedItems) || (job.status === "failed" && job.issues.length === 0) || (job.status === "ready" && valid === 0) || job.totalItems !== preview.length || job.validItems !== valid || job.invalidItems !== invalid || job.duplicateItems !== duplicates) issues.push({ jobId: job._id.toHexString(), status: job.status, stored: { totalItems: job.totalItems, validItems: job.validItems, invalidItems: job.invalidItems, duplicateItems: job.duplicateItems }, actual: { totalItems: preview.length, validItems: valid, invalidItems: invalid, duplicateItems: duplicates } });
  }
  console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
}
main().catch((error: unknown) => { console.error("Failed to audit import jobs", error); process.exitCode = 1; });
