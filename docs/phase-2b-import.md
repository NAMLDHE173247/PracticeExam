# Phase 2B import

Phase 2B implements backend-only JSON and structured-text question import. The flow is validate/preview, confirm, then transactionally insert questions and update exam-set counts. Preview never writes questions.

## Limits and request

`POST /api/questions/import/validate` accepts `{ subjectId, targetExamSetIds, inputFormat, content, fileName?, options? }`. The content limit is 5MB, each job is limited to 500 items, and stored issues are capped at 2,000. JSON can be an array or `{ questions: [] }`; code fences are not accepted. Structured text uses `[QUESTION]` blocks, case-insensitive fields, `A:`–`H:` options and `1: text | TRUE` statements.

## Duplicate policy

The default is `reject`; `skip` turns duplicates into skipped warnings; `allow` imports duplicates and never stores `allowDuplicate` in questions. Duplicate detection uses the Phase 2A `createQuestionContentHash` function and checks both the current batch and MongoDB.

## Job lifecycle

Jobs move `ready → importing → completed` through an atomic token-protected claim. `GET` never returns the confirm token or raw source content. Confirm reads the stored preview, not client-supplied questions. Repeated confirm after completion returns the previous result without inserting or incrementing counts. Cancel is allowed for `ready` and `failed`, is idempotent, and never deletes a job.

## Transactions

Confirm uses the shared MongoDB session helper for question inserts, exam-set count updates and job completion. A standalone local MongoDB cannot support this transaction; use MongoDB Atlas or a local replica set. No non-transaction fallback is used for confirm, so unsupported deployments return an error rather than leaving partial data.

## Supported and deferred formats

Supported: JSON and structured text. Deferred: PDF, DOCX, XLSX/CSV, OCR, AI parsing, translation services, frontend import UI, authentication, exam attempts and statistics.

Run `npm run db:audit:import-jobs` for a read-only consistency audit of import-job counters and statuses.
