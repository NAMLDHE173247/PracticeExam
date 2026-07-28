import type { ExamAttemptDocument } from "../exam-attempts/exam-attempt.types";
import { ApiError } from "../../lib/api/response";

export function serializeResult(attempt: ExamAttemptDocument) {
  if (attempt.status !== "submitted" && attempt.status !== "expired") {
    throw new ApiError("RESULT_NOT_READY", "Bài thi chưa được nộp, không thể xem kết quả.");
  }
  if (!attempt.resultSnapshot) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không khả dụng cho lượt làm bài này (có thể do được nộp trước khi hệ thống cập nhật phiên bản).");
  }

  return {
    attemptId: attempt._id.toHexString(),
    mode: attempt.mode,
    subjectId: attempt.subjectId.toHexString(),
    ...(attempt.examSetId ? { examSetId: attempt.examSetId.toHexString() } : {}),
    sourceExamSetIds: attempt.sourceExamSetIds.map((id) => id.toHexString()),
    
    status: attempt.status,
    submitReason: attempt.submitReason,
    
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString(),
    durationSeconds: attempt.durationSeconds,

    generatedAt: attempt.resultSnapshot.generatedAt.toISOString(),
    settings: attempt.settings,

    summary: attempt.resultSnapshot.summary,
    
    questions: attempt.resultSnapshot.questions.map(q => ({
      questionId: q.questionId.toHexString(),
      order: q.order,
      type: q.type,
      content: q.content,
      ...(q.options ? { options: q.options } : {}),
      ...(q.statements ? { statements: q.statements } : {}),
      
      userAnswer: q.userAnswer,
      result: q.result,
      ...(q.explanation ? { explanation: q.explanation } : {}),
      
      sourceExamSetIds: q.sourceExamSetIds.map(id => id.toHexString()),
      ...(q.originExamSetId ? { originExamSetId: q.originExamSetId.toHexString() } : {}),
    })),
  };
}
