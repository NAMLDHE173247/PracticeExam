import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { ApiError, errorResponse, parseObjectId } from "@/lib/api/response";
import { ExamAttemptRepository } from "@/modules/exam-attempts/exam-attempt.repository";

export async function GET(request: Request, props: { params: Promise<{ attemptId: string }> }) {
  try {
    const params = await props.params;
    const { searchParams } = new URL(request.url);
    const parsedUserId = searchParams.get("userId");
    if (!parsedUserId) throw new ApiError("VALIDATION_ERROR", "userId query parameter is required.");
    
    const userId = parseObjectId(parsedUserId, "userId");
    const attemptId = parseObjectId(params.attemptId, "attemptId");

    const attempts = new ExamAttemptRepository(await getCollection("exam_attempts"));
    const attempt = await attempts.findById(attemptId);

    if (!attempt) throw new ApiError("ATTEMPT_NOT_FOUND", "Không tìm thấy lượt làm bài.");
    if (!attempt.userId.equals(userId)) throw new ApiError("ATTEMPT_FORBIDDEN", "Bạn không có quyền truy cập kết quả này.");
    if (attempt.status !== "submitted" && attempt.status !== "expired") {
      throw new ApiError("RESULT_NOT_READY", "Bài thi chưa được nộp, không thể xem kết quả.");
    }
    if (!attempt.resultSnapshot) {
      throw new ApiError("INTERNAL_ERROR", "Dữ liệu kết quả chưa được khởi tạo.");
    }

    const payload = {
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

    return NextResponse.json({ result: payload });
  } catch (error) {
    return errorResponse(error);
  }
}
