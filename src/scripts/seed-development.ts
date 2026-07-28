import { ObjectId } from "mongodb";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const now = new Date("2026-01-01T00:00:00.000Z");

async function main(): Promise<void> {
  const { getCollection } = await import("../lib/mongodb");
  const users = await getCollection("users");
  await users.updateOne(
    { email: "admin@practice-exam.local" },
    { $set: { displayName: "Development Admin", role: "admin", isActive: true, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
  await users.updateOne(
    { email: "student@practice-exam.local" },
    { $set: { displayName: "Development Student", role: "student", isActive: true, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );

  const subjects = await getCollection("subjects");
  const subjectIds = new Map<string, ObjectId>();
  for (const subject of [
    { code: "ENW492C", name: "English Writing" },
    { code: "WDU203C", name: "Web User Experience" },
    { code: "PRN232", name: "Programming" },
  ]) {
    await subjects.updateOne(
      { code: subject.code },
      { $set: { name: subject.name, isActive: true, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    const saved = await subjects.findOne({ code: subject.code });
    if (saved) subjectIds.set(subject.code, saved._id);
  }

  const examSets = await getCollection("exam_sets");
  for (const [code, subjectId] of subjectIds) {
    await examSets.updateOne(
      { subjectId, title: `${code} Development Set` },
      { $set: { description: "Seed data for local development", status: "draft", questionCount: 0, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }

  console.log("Development seed completed idempotently.");
}

main().catch((error: unknown) => {
  console.error("Failed to seed development data", error);
  process.exitCode = 1;
});
