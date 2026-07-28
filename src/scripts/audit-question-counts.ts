import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { getCollection } = await import("../lib/mongodb");
  const examSets = await getCollection("exam_sets"); const questions = await getCollection("questions"); const rows = [];
  for await (const examSet of examSets.find({})) { const actual = await questions.countDocuments({ examSetIds: examSet._id }); rows.push({ examSetId: examSet._id.toHexString(), stored: examSet.questionCount, actual, matches: examSet.questionCount === actual }); }
  console.log(JSON.stringify(rows, null, 2));
}
main().catch((error: unknown) => { console.error("Failed to audit question counts", error); process.exitCode = 1; });
