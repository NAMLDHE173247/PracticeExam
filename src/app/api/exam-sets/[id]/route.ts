import { parseObjectId, errorResponse, parseJson, successResponse } from "@/lib/api/response";
import { serializeValue } from "@/lib/api/serialize";
import { getExamSetService } from "@/modules/exam-sets/exam-set.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) { try { const { id } = await context.params; return successResponse(serializeValue(await (await getExamSetService()).get(parseObjectId(id)))); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, context: Context) { try { const { id } = await context.params; return successResponse(serializeValue(await (await getExamSetService()).update(parseObjectId(id), await parseJson(request)))); } catch (error) { return errorResponse(error); } }
export async function DELETE(_request: Request, context: Context) { try { const { id } = await context.params; return successResponse(serializeValue(await (await getExamSetService()).remove(parseObjectId(id)))); } catch (error) { return errorResponse(error); } }
