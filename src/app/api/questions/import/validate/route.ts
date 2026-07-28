import { errorResponse, parseJson, successResponse } from "@/lib/api/response";
import { getQuestionImportService } from "@/modules/imports/import.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { try { return successResponse(await (await getQuestionImportService()).validate(await parseJson(request))); } catch (error) { return errorResponse(error); } }
