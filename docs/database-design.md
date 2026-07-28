# Database design — Phase 1

Phase 1 only establishes the MongoDB data contract, validation and grading primitives. Frontend, history, statistics, wrong-question practice and the new API modules are intentionally deferred.

## Collections

- `users`: account identity, role (`admin`/`student`) and active state.
- `subjects`: unique subject code and display metadata.
- `exam_sets`: an exam set belonging to a subject; question membership is represented by `questions.examSetIds`.
- `questions`: normalized question content. `single_choice` and `multiple_choice` use options; `true_false_group` uses statements.
- `exam_attempts`: attempt metadata and a question snapshot captured at start time.
- `user_answers`: one answer per `(attemptId, questionId)`, with grading output.
- `question_import_jobs`: asynchronous import status, counters and row-level issues.

The attempt snapshot deliberately contains question text and option/statement identifiers, but never `isCorrect` or true/false `answer` fields. `user_question_progress` is not implemented in this phase; its design decision and indexes will be handled in Phase 3 after real practice-flow requirements are known.

## Access and indexes

MongoDB access is split into client, database and typed collection helpers under `src/lib/mongodb/`. Run `npm run db:indexes` after configuring `.env.local`. The script is safe to run repeatedly because index names are stable.

## Legacy compatibility and migration

The existing `question_sets` collection and `/api/question-sets` route remain available in Phase 1 so the current frontend does not break. The GET route no longer seeds data. New code should target `subjects`, `exam_sets` and `questions`; no automatic rename or deletion is performed.

Before migration, run `npm run db:audit:legacy`. It reports whether legacy `createdAt` or `updatedAt` values are strings. The proposed migration is:

1. export a backup of `question_sets`;
2. map `subject` to `subjects.code`, then map each legacy set to an `exam_sets` document;
3. convert parseable date strings to BSON `Date`, preserving unparseable values in a migration log for manual review;
4. validate question counts and compare old/new records;
5. switch API reads only after verification, then retain the compatibility route during a transition window.

This migration is not automatic in Phase 1 and does not delete old records.

## Transactions

Attempt start, autosave and submit may require transactions when implemented. A local standalone MongoDB instance does not support transactions by default. Use MongoDB Atlas or configure a local replica set before relying on transaction semantics; otherwise the implementation must use explicit compensating checks.

## Development data

`npm run db:seed` creates only development users, subjects and exam sets using stable upserts, so it is idempotent. Seed execution is explicit and is never performed from a GET handler.

## Deferred phases

- Phase 2: new subject, exam-set, question, import and admin APIs while retaining the legacy API.
- Phase 3: attempt runtime, answer persistence, history, statistics, wrong-question practice and the `user_question_progress` decision/implementation.
