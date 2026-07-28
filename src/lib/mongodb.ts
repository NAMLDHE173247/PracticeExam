import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI in .env.local");
}

declare global {
  var mongodbClientPromise: Promise<MongoClient> | undefined;
}

const clientPromise =
  process.env.NODE_ENV === "development"
    ? (global.mongodbClientPromise ??= new MongoClient(uri).connect())
    : new MongoClient(uri).connect();

export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB ?? "practice_exam");
}
