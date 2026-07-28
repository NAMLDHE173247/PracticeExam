import { errorResponse, parseJson, parseObjectId, successResponse } from "@/lib/api/response";
import { getExamAttemptService } from "@/modules/exam-attempts/exam-attempt.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return successResponse({ attempt: await (await getExamAttemptService()).submit(parseObjectId(id), await parseJson(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}
