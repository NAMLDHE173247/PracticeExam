import { ApiError, errorResponse, parseObjectId, successResponse } from "@/lib/api/response";
import { getExamAttemptService } from "@/modules/exam-attempts/exam-attempt.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) throw new ApiError("VALIDATION_ERROR", "userId là bắt buộc.");
    return successResponse({ attempt: await (await getExamAttemptService()).get(parseObjectId(id), parseObjectId(userId, "userId")) });
  } catch (error) {
    return errorResponse(error);
  }
}
