import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { getCollection } = await import("../lib/mongodb");
  const attempts = await getCollection("exam_attempts");
  const answers = await getCollection("user_answers");
  const issues: Array<Record<string, unknown>> = [];
  const attemptIds = new Set<string>();
  for await (const attempt of attempts.find({})) {
    const id = attempt._id.toHexString();
    attemptIds.add(id);
    const questionIds = attempt.questionIds ?? [];
    const snapshots = attempt.questionSnapshots ?? [];
    const answerKeys = attempt.answerKeySnapshots ?? [];
    const questionIdSet = new Set(questionIds.map((item) => item.toHexString()));
    const snapshotIdSet = new Set(snapshots.map((item) => item.questionId.toHexString()));
    const keyIdSet = new Set(answerKeys.map((item) => item.questionId.toHexString()));
    if (questionIdSet.size !== questionIds.length) issues.push({ type: "duplicate_attempt_question_ids", attemptId: id });
    if (snapshotIdSet.size !== snapshots.length) issues.push({ type: "duplicate_snapshot_question_ids", attemptId: id });
    if (attempt.deadlineAt < attempt.startedAt) issues.push({ type: "deadline_before_started", attemptId: id });
    if (snapshotIdSet.size !== keyIdSet.size || [...snapshotIdSet].some((questionId) => !keyIdSet.has(questionId))) issues.push({ type: "snapshot_answer_key_mismatch", attemptId: id });
    if (attempt.status === "submitting" && attempt.updatedAt < new Date(Date.now() - 10 * 60 * 1000)) issues.push({ type: "submitting_stuck", attemptId: id });
    if ((attempt.status === "submitted" || attempt.status === "expired") && (attempt.score === undefined || attempt.totalMaxPoints === undefined)) issues.push({ type: "submitted_missing_score", attemptId: id });
    const countTotal = (attempt.correctCount ?? 0) + (attempt.incorrectCount ?? 0) + (attempt.unansweredCount ?? 0) + (attempt.partiallyCorrectCount ?? 0);
    if (attempt.status === "submitted" || attempt.status === "expired") {
      if (countTotal !== snapshots.length) issues.push({ type: "count_mismatch", attemptId: id, countTotal, questionCount: snapshots.length });
      if (answerKeys.length !== snapshots.length) issues.push({ type: "answer_key_count_mismatch", attemptId: id });
    }
    if (attempt.status === "in_progress" && attempt.deadlineAt < new Date()) issues.push({ type: "in_progress_past_deadline", attemptId: id });
    const answerList = await answers.find({ attemptId: attempt._id }).toArray();
    const seen = new Set<string>();
    for (const answer of answerList) {
      const questionId = answer.questionId.toHexString();
      if (seen.has(questionId)) issues.push({ type: "duplicate_answer", attemptId: id, questionId });
      seen.add(questionId);
      if (!questionIds.some((item) => item.equals(answer.questionId))) issues.push({ type: "answer_question_not_in_attempt", attemptId: id, questionId });
      if ((attempt.status === "submitted" || attempt.status === "expired") && !answer.grading) issues.push({ type: "submitted_answer_missing_grading", attemptId: id, questionId });
    }
  }
  for await (const answer of answers.find({})) {
    if (!attemptIds.has(answer.attemptId.toHexString())) issues.push({ type: "orphan_answer", answerId: answer._id.toHexString(), attemptId: answer.attemptId.toHexString() });
  }
  console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
}

main().catch((error: unknown) => { console.error("Failed to audit attempts", error); process.exitCode = 1; });
