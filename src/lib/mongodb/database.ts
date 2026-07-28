import type { Db } from "mongodb";
import { getMongoClient } from "./client";

export async function getDatabase(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "practice_exam");
}
