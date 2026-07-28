import type { IndexDescription } from "mongodb";
import type { CollectionDocumentMap } from "../lib/mongodb/collections";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const indexDefinitions: Array<{ collection: keyof CollectionDocumentMap; indexes: IndexDescription[] }> = [
  { collection: "users", indexes: [{ key: { email: 1 }, name: "users_email_unique", unique: true }] },
  { collection: "subjects", indexes: [{ key: { code: 1 }, name: "subjects_code_unique", unique: true }, { key: { isActive: 1, name: 1 }, name: "subjects_active_name" }] },
  { collection: "exam_sets", indexes: [{ key: { subjectId: 1, status: 1, updatedAt: -1 }, name: "exam_sets_subject_status_updated" }, { key: { subjectId: 1, title: 1 }, name: "exam_sets_subject_title" }] },
  { collection: "questions", indexes: [{ key: { subjectId: 1, status: 1 }, name: "questions_subject_status" }, { key: { examSetIds: 1, status: 1 }, name: "questions_exam_sets_status" }, { key: { subjectId: 1, tags: 1 }, name: "questions_subject_tags" }, { key: { subjectId: 1, difficulty: 1 }, name: "questions_subject_difficulty" }, { key: { subjectId: 1, contentHash: 1 }, name: "questions_subject_hash" }] },
  { collection: "exam_attempts", indexes: [{ key: { userId: 1, createdAt: -1 }, name: "attempts_user_created" }, { key: { userId: 1, status: 1, updatedAt: -1 }, name: "attempts_user_status_updated" }, { key: { subjectId: 1, mode: 1, createdAt: -1 }, name: "attempts_subject_mode_created" }, { key: { examSetId: 1, createdAt: -1 }, name: "attempts_exam_set_created" }] },
  { collection: "user_answers", indexes: [{ key: { attemptId: 1, questionId: 1 }, name: "answers_attempt_question_unique", unique: true }, { key: { userId: 1, attemptId: 1 }, name: "answers_user_attempt" }, { key: { userId: 1, questionId: 1, "grading.isCorrect": 1 }, name: "answers_user_question_correct" }] },
  { collection: "question_import_jobs", indexes: [{ key: { userId: 1, createdAt: -1 }, name: "import_jobs_user_created" }, { key: { status: 1, updatedAt: -1 }, name: "import_jobs_status_updated" }] },
];

async function main(): Promise<void> {
  const { getCollection } = await import("../lib/mongodb");
  for (const definition of indexDefinitions) {
    const collection = await getCollection(definition.collection);
    await collection.createIndexes(definition.indexes);
    console.log(`Indexes ready: ${definition.collection}`);
  }
}

main().catch((error: unknown) => {
  console.error("Failed to create indexes", error);
  process.exitCode = 1;
});
