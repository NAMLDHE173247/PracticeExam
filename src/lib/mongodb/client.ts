import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI in .env.local");
}

declare global {
  var practiceExamMongoClientPromise: Promise<MongoClient> | undefined;
}

const clientPromise =
  process.env.NODE_ENV === "development"
    ? (global.practiceExamMongoClientPromise ??= new MongoClient(uri).connect())
    : new MongoClient(uri).connect();

export async function getMongoClient(): Promise<MongoClient> {
  return clientPromise;
}
