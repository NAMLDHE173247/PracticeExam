import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { getCollection } = await import("../lib/mongodb");
  const collection = await getCollection("question_sets");
  const documents = await collection.find({}, { projection: { createdAt: 1, updatedAt: 1 } }).toArray();
  const createdAtStrings = documents.filter((document) => typeof document.createdAt === "string").length;
  const updatedAtStrings = documents.filter((document) => typeof document.updatedAt === "string").length;
  console.log(JSON.stringify({ total: documents.length, createdAtStrings, updatedAtStrings }, null, 2));
  console.log("Audit only: no legacy data was modified or deleted.");
}

main().catch((error: unknown) => {
  console.error("Failed to audit legacy question sets", error);
  process.exitCode = 1;
});
