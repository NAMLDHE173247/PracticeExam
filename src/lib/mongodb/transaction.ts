import type { ClientSession, TransactionOptions } from "mongodb";
import { getMongoClient } from "./client";

export async function runInTransaction<T>(work: (session: ClientSession) => Promise<T>, options?: TransactionOptions): Promise<T> {
  const client = await getMongoClient();
  const session = client.startSession();
  try { return await session.withTransaction(() => work(session), options); } finally { await session.endSession(); }
}
