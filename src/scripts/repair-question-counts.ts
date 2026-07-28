import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { getCollection } = await import("../lib/mongodb");
  const examSets = await getCollection("exam_sets"); const questions = await getCollection("questions");
  for await (const examSet of examSets.find({})) { const actual = await questions.countDocuments({ examSetIds: examSet._id }); if (actual !== examSet.questionCount) await examSets.updateOne({ _id: examSet._id }, { $set: { questionCount: actual, updatedAt: new Date() } }); }
  console.log("Question counts repaired. Run npm run db:audit:question-counts to verify.");
}
main().catch((error: unknown) => { console.error("Failed to repair question counts", error); process.exitCode = 1; });
