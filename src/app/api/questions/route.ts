import { parsePageQuery, paginationMeta } from "@/lib/api/query";
import { errorResponse, parseJson, successResponse } from "@/lib/api/response";
import { serializeValue } from "@/lib/api/serialize";
import { getQuestionService } from "@/modules/questions/question.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { const page = parsePageQuery(new URL(request.url).searchParams); const result = await (await getQuestionService()).list(Object.fromEntries(new URL(request.url).searchParams), page.page, page.pageSize); return successResponse(serializeValue(result.items), paginationMeta(page, result.total)); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { return successResponse(serializeValue(await (await getQuestionService()).create(await parseJson(request)))); } catch (error) { return errorResponse(error); } }
