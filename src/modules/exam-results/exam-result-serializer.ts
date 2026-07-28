import type { ExamAttemptDocument } from "../exam-attempts/exam-attempt.types";
import { ApiError } from "../../lib/api/response";

export function serializeResult(attempt: ExamAttemptDocument) {
  if (attempt.status !== "submitted" && attempt.status !== "expired") {
    throw new ApiError("RESULT_NOT_READY", "Bài thi chưa được nộp, không thể xem kết quả.");
  }
  
  if (!attempt.submittedAt || !attempt.submitReason) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Thiếu thông tin nộp bài.");
  }

  if (!attempt.resultSnapshot) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không khả dụng cho lượt làm bài này (có thể do được nộp trước khi hệ thống cập nhật phiên bản).");
  }

  const { items, questions: legacyQuestions, summary, generatedAt } = attempt.resultSnapshot;
  
  let mergedQuestions: any[] = [];

  if (items) {
    if (items.length !== attempt.questionSnapshots.length || attempt.answerKeySnapshots.length !== attempt.questionSnapshots.length || summary.totalQuestions !== attempt.questionSnapshots.length) {
      throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Số lượng câu hỏi không khớp.");
    }
    
    if (summary.correctCount + summary.partiallyCorrectCount + summary.incorrectCount + summary.unansweredCount !== summary.totalQuestions) {
      throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Tổng số câu trả lời không khớp.");
    }

    mergedQuestions = attempt.questionSnapshots.map(snapshot => {
      const answerKey = attempt.answerKeySnapshots.find(k => k.questionId.equals(snapshot.questionId));
      const item = items.find(i => i.questionId.equals(snapshot.questionId));
      
      if (!answerKey || !item) {
         throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Thiếu thông tin cho câu hỏi.");
      }

      return {
        questionId: snapshot.questionId.toHexString(),
        order: snapshot.order,
        type: snapshot.type,
        content: snapshot.content,
        ...(snapshot.options ? { options: snapshot.options } : {}),
        ...(snapshot.statements ? { statements: snapshot.statements } : {}),
        
        userAnswer: item.userAnswer,
        result: {
          ...item.result,
          correctOptionIds: answerKey.correctOptionIds,
          correctStatementAnswers: answerKey.correctStatementAnswers,
        },
        ...(answerKey.explanation ? { explanation: answerKey.explanation } : {}),
        
        sourceExamSetIds: snapshot.sourceExamSetIds.map(id => id.toHexString()),
        ...(snapshot.originExamSetId ? { originExamSetId: snapshot.originExamSetId.toHexString() } : {}),
      };
    });
  } else if (legacyQuestions) {
    if (legacyQuestions.length !== attempt.questionSnapshots.length) {
      throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ (Legacy): Số lượng câu hỏi không khớp.");
    }
    mergedQuestions = legacyQuestions.map(q => ({
        ...q,
        questionId: q.questionId.toString(),
        sourceExamSetIds: q.sourceExamSetIds.map((id: any) => id.toString()),
        ...(q.originExamSetId ? { originExamSetId: q.originExamSetId.toString() } : {}),
    }));
  } else {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Không tìm thấy nội dung bài thi.");
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
    submittedAt: attempt.submittedAt.toISOString(),
    durationSeconds: attempt.durationSeconds,

    generatedAt: generatedAt.toISOString(),
    settings: attempt.settings,

    summary,
    questions: mergedQuestions,
  };
}
