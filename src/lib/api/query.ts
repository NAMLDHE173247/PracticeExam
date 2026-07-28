import { ApiError } from "./response";

export interface PageQuery { page: number; pageSize: number; skip: number; }

export function parsePageQuery(searchParams: URLSearchParams): PageQuery {
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new ApiError("VALIDATION_ERROR", "page phải >= 1 và pageSize phải từ 1 đến 100.");
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function parseOrder(value: string | null): 1 | -1 { return value === "desc" ? -1 : 1; }
export function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
export function paginationMeta(page: PageQuery, total: number): Record<string, number> { return { page: page.page, pageSize: page.pageSize, total, totalPages: Math.ceil(total / page.pageSize) }; }
