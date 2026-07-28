import { ObjectId } from "mongodb";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const now = new Date("2026-01-01T00:00:00.000Z");
const text = (original: string, vi: string) => ({ original, vi });

async function main(): Promise<void> {
  const { getCollection } = await import("../lib/mongodb");
  const users = await getCollection("users");
  for (const user of [
    { email: "admin@practice-exam.local", displayName: "Development Admin", role: "admin" as const },
    { email: "student@practice-exam.local", displayName: "Development Student", role: "student" as const },
  ]) {
    await users.updateOne(
      { email: user.email },
      { $set: { displayName: user.displayName, role: user.role, isActive: true, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }

  const subjects = await getCollection("subjects");
  const subjectIds = new Map<string, ObjectId>();
  for (const subject of [
    { code: "ENW492C", name: "English Writing" },
    { code: "WDU203C", name: "Web User Experience" },
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
  const examSetIds = new Map<string, ObjectId[]>();
  for (const [code, subjectId] of subjectIds) {
    const ids: ObjectId[] = [];
    for (const suffix of ["A", "B"]) {
      const title = `${code} Development Set ${suffix}`;
      await examSets.updateOne(
        { subjectId, title },
        { $set: { description: "Seed data for local development", status: "draft", updatedAt: now }, $setOnInsert: { createdAt: now, questionCount: 0 } },
        { upsert: true },
      );
      const saved = await examSets.findOne({ subjectId, title });
      if (saved) ids.push(saved._id);
    }
    examSetIds.set(code, ids);
  }

  const questions = await getCollection("questions");
  const questionSeeds = [
    {
      code: "ENW492C", hash: "development-enw-single", type: "single_choice" as const,
      content: text("Which sentence is grammatically correct?", "Câu nào đúng ngữ pháp?"),
      options: [
        { id: "A", label: "A", content: text("She go to class.", "Cô ấy đi đến lớp."), isCorrect: false },
        { id: "B", label: "B", content: text("She goes to class.", "Cô ấy đi đến lớp."), isCorrect: true },
      ],
    },
    {
      code: "ENW492C", hash: "development-enw-multiple", type: "multiple_choice" as const,
      content: text("Select the formal greetings.", "Chọn các lời chào trang trọng."),
      options: [
        { id: "A", label: "A", content: text("Good morning.", "Chào buổi sáng."), isCorrect: true },
        { id: "B", label: "B", content: text("Dear Professor.", "Kính gửi Giáo sư."), isCorrect: true },
        { id: "C", label: "C", content: text("Hey there!", "Chào nhé!"), isCorrect: false },
      ],
    },
    {
      code: "WDU203C", hash: "development-wdu-true-false", type: "true_false_group" as const,
      content: text("Evaluate the web design statements.", "Đánh giá các nhận định về thiết kế web."),
      statements: [
        { id: "S1", content: text("A clear hierarchy helps users scan a page.", "Phân cấp rõ ràng giúp người dùng quét trang."), answer: true },
        { id: "S2", content: text("Accessibility is unrelated to interface design.", "Khả năng tiếp cận không liên quan đến thiết kế giao diện."), answer: false },
      ],
    },
  ];

  for (const seed of questionSeeds) {
    const subjectId = subjectIds.get(seed.code);
    const examSetId = examSetIds.get(seed.code)?.[0];
    if (!subjectId || !examSetId) continue;
    const question = {
      _id: new ObjectId(), subjectId, examSetIds: [examSetId], type: seed.type, content: seed.content,
      ...(seed.type === "true_false_group" ? { statements: seed.statements } : { options: seed.options }),
      tags: ["development"], status: "published" as const, contentHash: seed.hash, createdAt: now, updatedAt: now,
    };
    await questions.updateOne({ subjectId, contentHash: seed.hash }, { $setOnInsert: question }, { upsert: true });
  }

  for (const [code, subjectId] of subjectIds) {
    const firstExamSetId = examSetIds.get(code)?.[0];
    if (!firstExamSetId) continue;
    const questionCount = await questions.countDocuments({ subjectId, examSetIds: firstExamSetId });
    await examSets.updateOne({ _id: firstExamSetId }, { $set: { questionCount, updatedAt: now } });
  }

  console.log("Development seed completed idempotently.");
}

main().catch((error: unknown) => {
  console.error("Failed to seed development data", error);
  process.exitCode = 1;
});
