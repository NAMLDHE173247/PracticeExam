import { parsePageQuery, paginationMeta } from "@/lib/api/query";
import { errorResponse, parseJson, successResponse } from "@/lib/api/response";
import { serializeValue } from "@/lib/api/serialize";
import { getSubjectService } from "@/modules/subjects/subject.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { const page = parsePageQuery(new URL(request.url).searchParams); const result = await (await getSubjectService()).list(Object.fromEntries(new URL(request.url).searchParams), page.page, page.pageSize); return successResponse(serializeValue(result.items), paginationMeta(page, result.total)); } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try { const subject = await (await getSubjectService()).create(await parseJson(request)); return successResponse(serializeValue(subject)); } catch (error) { return errorResponse(error); }
}
