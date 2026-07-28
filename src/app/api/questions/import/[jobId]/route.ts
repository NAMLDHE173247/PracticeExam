import { parseObjectId, errorResponse, successResponse } from "@/lib/api/response";
import { serializeValue } from "@/lib/api/serialize";
import { getQuestionImportService } from "@/modules/imports/import.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) { try { const { jobId } = await context.params; return successResponse(serializeValue(await (await getQuestionImportService()).get(parseObjectId(jobId, "jobId")))); } catch (error) { return errorResponse(error); } }
