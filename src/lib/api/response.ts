import { ObjectId } from "mongodb";

export type ApiErrorCode = "VALIDATION_ERROR" | "INVALID_OBJECT_ID" | "NOT_FOUND" | "DUPLICATE_RESOURCE" | "RESOURCE_IN_USE" | "INVALID_RELATION" | "CONFLICT" | "INTERNAL_ERROR" | "IMPORT_PARSE_ERROR" | "IMPORT_NOT_READY" | "IMPORT_ALREADY_RUNNING" | "IMPORT_ALREADY_COMPLETED" | "IMPORT_CANCELLED" | "IMPORT_NO_VALID_ITEMS" | "IMPORT_CONFIRM_TOKEN_INVALID" | "IMPORT_TOO_LARGE" | "TRANSACTION_REQUIRED";

export class ApiError extends Error {
  constructor(public readonly code: ApiErrorCode, message: string, public readonly details?: unknown, public readonly status = code === "NOT_FOUND" ? 404 : code === "VALIDATION_ERROR" || code === "INVALID_OBJECT_ID" ? 400 : code === "IMPORT_TOO_LARGE" ? 413 : code === "DUPLICATE_RESOURCE" || code === "CONFLICT" || code.startsWith("IMPORT_") ? 409 : code === "RESOURCE_IN_USE" ? 409 : code === "TRANSACTION_REQUIRED" ? 503 : 500) {
    super(message);
  }
}

export function successResponse<T>(data: T, meta?: Record<string, number>): Response { return Response.json({ success: true, data, ...(meta ? { meta } : {}) }); }

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) return Response.json({ success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, { status: error.status });
  if (error instanceof Error && /transaction numbers are only allowed|replica set|transactions support|transaction support/i.test(error.message)) return Response.json({ success: false, error: { code: "TRANSACTION_REQUIRED", message: "MongoDB transaction yêu cầu replica set hoặc MongoDB Atlas." } }, { status: 503 });
  if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) return Response.json({ success: false, error: { code: "DUPLICATE_RESOURCE", message: "Tài nguyên đã tồn tại." } }, { status: 409 });
  console.error(error); return Response.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Đã xảy ra lỗi máy chủ." } }, { status: 500 });
}

export async function parseJson(request: Request): Promise<unknown> { try { return await request.json(); } catch { throw new ApiError("VALIDATION_ERROR", "JSON không hợp lệ."); } }
export function parseObjectId(value: string, field = "id"): ObjectId { if (!ObjectId.isValid(value)) throw new ApiError("INVALID_OBJECT_ID", `${field} không hợp lệ.`); return new ObjectId(value); }
