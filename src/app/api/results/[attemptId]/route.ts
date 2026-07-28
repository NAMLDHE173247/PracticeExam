import { NextResponse } from "next/server";
import { errorResponse, parseObjectId, successResponse, ApiError } from "@/lib/api/response";
import { getExamResultService } from "@/modules/exam-results/exam-result.service";

export async function GET(request: Request, props: { params: Promise<{ attemptId: string }> }) {
  try {
    const params = await props.params;
    const { searchParams } = new URL(request.url);
    const parsedUserId = searchParams.get("userId");
    if (!parsedUserId) throw new ApiError("VALIDATION_ERROR", "userId query parameter is required.");
    
    const userId = parseObjectId(parsedUserId, "userId");
    const attemptId = parseObjectId(params.attemptId, "attemptId");

    const service = await getExamResultService();
    const result = await service.getResult(attemptId, userId);

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
