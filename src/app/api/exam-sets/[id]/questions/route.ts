import { parsePageQuery, paginationMeta } from "@/lib/api/query";
import { parseObjectId, errorResponse, successResponse } from "@/lib/api/response";
import { parseJson } from "@/lib/api/response";
import { serializeValue } from "@/lib/api/serialize";
import { getExamSetService } from "@/modules/exam-sets/exam-set.service";
import { getQuestionService } from "@/modules/questions/question.service";
import { ApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const page = parsePageQuery(new URL(request.url).searchParams); const result = await (await getExamSetService()).listQuestions(parseObjectId(id), page.page, page.pageSize); return successResponse(serializeValue(result.items), paginationMeta(page, result.total)); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; const examSetId = parseObjectId(id, "examSetId"); const body = await parseJson(request) as { mode?: string; questionId?: string; question?: Record<string, unknown> }; if (body.mode === "attach" && body.questionId) return successResponse(serializeValue(await (await getQuestionService()).attach(examSetId, parseObjectId(body.questionId, "questionId")))); if (body.mode === "create" && body.question) return successResponse(serializeValue(await (await getQuestionService()).create({ ...body.question, examSetIds: [...((body.question.examSetIds as string[] | undefined) ?? []), id] }))); throw new ApiError("VALIDATION_ERROR", "mode phải là attach hoặc create với dữ liệu hợp lệ."); } catch (error) { return errorResponse(error); } }
