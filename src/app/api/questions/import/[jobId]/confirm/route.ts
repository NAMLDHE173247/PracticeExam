import { parseJson, parseObjectId, errorResponse, successResponse } from "@/lib/api/response";
import { serializeValue } from "@/lib/api/serialize";
import { getQuestionImportService } from "@/modules/imports/import.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) { try { const { jobId } = await context.params; return successResponse(serializeValue(await (await getQuestionImportService()).confirm(parseObjectId(jobId, "jobId"), await parseJson(request)))); } catch (error) { return errorResponse(error); } }
