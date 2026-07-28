import type { ExamAttemptDocument, ExamResultItemSnapshot } from "../exam-attempts/exam-attempt.types";
import { ApiError } from "../../lib/api/response";
import { roundScore } from "../exam-attempts/exam-attempt-scoring";
import type { SerializedExamResult, SerializedExamResultQuestion, LegacyExamResultQuestionSnapshot } from "./exam-result.types";

export function serializeResult(attempt: ExamAttemptDocument): SerializedExamResult {
  if (attempt.status !== "submitted" && attempt.status !== "expired") {
    throw new ApiError("RESULT_NOT_READY", "Bài thi chưa được nộp, không thể xem kết quả.");
  }
  
  if (!attempt.submittedAt || !attempt.submitReason) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Thiếu thông tin nộp bài.");
  }

  if (!attempt.resultSnapshot) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không khả dụng cho lượt làm bài này (có thể do được nộp trước khi hệ thống cập nhật phiên bản).");
  }

  const { version, summary, generatedAt } = attempt.resultSnapshot;
  
  if (summary.totalQuestions !== attempt.questionSnapshots.length || attempt.answerKeySnapshots.length !== attempt.questionSnapshots.length) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Số lượng câu hỏi không khớp.");
  }

  if (summary.correctCount + summary.partiallyCorrectCount + summary.incorrectCount + summary.unansweredCount !== summary.totalQuestions) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Tổng số câu trả lời không khớp.");
  }

  if (summary.correctCount !== attempt.correctCount || summary.partiallyCorrectCount !== attempt.partiallyCorrectCount || summary.incorrectCount !== attempt.incorrectCount || summary.unansweredCount !== attempt.unansweredCount) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Summary counts không khớp với root attempt.");
  }

  if (summary.score !== attempt.score) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Điểm số không khớp với root attempt.");
  }

  if (summary.scoreScale !== attempt.scoreScale || summary.scoreScale !== 10) {
    throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Thang điểm không khớp.");
  }

  let mergedQuestions: SerializedExamResultQuestion[] = [];

  if (version === 2 && attempt.resultSnapshot.items) {
    const items = attempt.resultSnapshot.items;
    if (items.length !== attempt.questionSnapshots.length) {
      throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Số lượng result items không khớp.");
    }

    let derivedCorrect = 0, derivedPartial = 0, derivedIncorrect = 0, derivedUnanswered = 0;
    let derivedEarned = 0, derivedMax = 0;

    for (const item of items) {
      if (item.result.earnedScore < 0 || item.result.earnedScore > item.result.maxScore) {
        throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", `Dữ liệu kết quả không hợp lệ: Điểm số câu hỏi không hợp lệ (${item.result.earnedScore}/${item.result.maxScore}).`);
      }
      derivedEarned += item.result.earnedScore;
      derivedMax += item.result.maxScore;

      switch (item.result.status) {
        case "correct":
          derivedCorrect++;
          break;
        case "partial":
          derivedPartial++;
          break;
        case "incorrect":
          derivedIncorrect++;
          break;
        case "unanswered":
          derivedUnanswered++;
          break;
        default:
          throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Trạng thái kết quả câu hỏi không hợp lệ.");
      }
    }

    if (derivedCorrect !== summary.correctCount || derivedPartial !== summary.partiallyCorrectCount || derivedIncorrect !== summary.incorrectCount || derivedUnanswered !== summary.unansweredCount) {
      throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Trạng thái câu trả lời không khớp với summary.");
    }

    if (derivedEarned !== attempt.totalEarnedPoints || derivedMax !== attempt.totalMaxPoints) {
      throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Tổng điểm không khớp với root attempt.");
    }

    const derivedScore = roundScore(derivedMax > 0 ? (derivedEarned / derivedMax) * attempt.scoreScale : 0);

    if (derivedScore !== summary.score || derivedScore !== attempt.score) {
      throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ: Điểm tổng không khớp với điểm từng câu.");
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
  } else if ((!version || version === 1) && attempt.resultSnapshot.questions) {
    const legacyQuestions = attempt.resultSnapshot.questions as LegacyExamResultQuestionSnapshot[];
    if (legacyQuestions.length !== attempt.questionSnapshots.length) {
      throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả không hợp lệ (Legacy): Số lượng câu hỏi không khớp.");
    }
    mergedQuestions = legacyQuestions.map(q => {
      if (!q || !q.questionId || !Array.isArray(q.sourceExamSetIds)) {
        throw new ApiError("RESULT_SNAPSHOT_UNAVAILABLE", "Dữ liệu kết quả legacy không hợp lệ.");
      }
      const { questionId: _oldId, sourceExamSetIds: _oldSourceIds, originExamSetId: _oldOriginId, ...rest } = q;
      return {
        ...rest,
        questionId: q.questionId.toString(),
        sourceExamSetIds: q.sourceExamSetIds.map((id: any) => id.toString()),
        ...(q.originExamSetId ? { originExamSetId: q.originExamSetId.toString() } : {}),
      };
    });
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
