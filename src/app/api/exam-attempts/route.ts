import { errorResponse, parseJson, successResponse } from "@/lib/api/response";
import { getExamAttemptService } from "@/modules/exam-attempts/exam-attempt.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return successResponse({ attempt: await (await getExamAttemptService()).create(await parseJson(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}
