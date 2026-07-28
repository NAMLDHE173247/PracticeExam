import { parseObjectId, errorResponse, parseJson, successResponse } from "@/lib/api/response";
import { serializeValue } from "@/lib/api/serialize";
import { getSubjectService } from "@/modules/subjects/subject.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) { try { const { id } = await context.params; return successResponse(serializeValue(await (await getSubjectService()).get(parseObjectId(id)))); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, context: Context) { try { const { id } = await context.params; return successResponse(serializeValue(await (await getSubjectService()).update(parseObjectId(id), await parseJson(request)))); } catch (error) { return errorResponse(error); } }
export async function DELETE(_request: Request, context: Context) { try { const { id } = await context.params; return successResponse(serializeValue(await (await getSubjectService()).remove(parseObjectId(id)))); } catch (error) { return errorResponse(error); } }
