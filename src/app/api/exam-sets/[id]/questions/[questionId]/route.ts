import { parseObjectId, errorResponse, successResponse } from "@/lib/api/response";
import { serializeValue } from "@/lib/api/serialize";
import { getQuestionService } from "@/modules/questions/question.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function DELETE(_request: Request, context: { params: Promise<{ id: string; questionId: string }> }) { try { const { id, questionId } = await context.params; return successResponse(serializeValue(await (await getQuestionService()).detach(parseObjectId(id, "examSetId"), parseObjectId(questionId, "questionId")))); } catch (error) { return errorResponse(error); } }
