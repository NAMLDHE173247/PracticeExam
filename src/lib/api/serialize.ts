import { ObjectId } from "mongodb";

export function serializeValue<T>(value: T): T {
  if (value instanceof ObjectId) return value.toHexString() as T;
  if (value instanceof Date) return value.toISOString() as T;
  if (Array.isArray(value)) return value.map(serializeValue) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)])) as T;
  return value;
}
