import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { LegacyQuestionSetDocument } from "@/modules/exam-sets/exam-set.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeExamSet(examSet: LegacyQuestionSetDocument) {
  return {
    id: examSet._id?.toString() ?? "",
    subject: examSet.subject,
    title: examSet.title,
    questions: examSet.questions,
    status: examSet.status ?? "Draft",
    updatedAt: examSet.updatedAt ?? "",
    accent: examSet.accent ?? "blue",
  };
}

export async function GET() {
  try {
    const collection = await getCollection("question_sets");
    const examSets = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return Response.json(examSets.map((examSet) => serializeExamSet(examSet)));
  } catch (error) {
    console.error("Failed to load question sets", error);
    return Response.json({ error: "Không thể kết nối MongoDB hoặc tải question sets." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { subject?: unknown; title?: unknown; questions?: unknown };
    const allowedSubjects = new Set(["ENW492c", "WDU203c", "PRN232"]);
    const subject = typeof body.subject === "string" ? body.subject : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const questions = typeof body.questions === "number" ? body.questions : Number(body.questions);

    if (!allowedSubjects.has(subject) || !title || !Number.isInteger(questions) || questions < 1) {
      return Response.json({ error: "Dữ liệu question set không hợp lệ." }, { status: 400 });
    }

    const accent = subject === "ENW492c" ? "blue" : subject === "WDU203c" ? "green" : "orange";
    const document: Omit<LegacyQuestionSetDocument, "_id"> = {
      subject,
      title,
      questions,
      status: "Draft",
      updatedAt: "Just now",
      accent,
      createdAt: new Date(),
    };
    const collection = await getCollection("question_sets");
    const record = { ...document, _id: new ObjectId() };
    await collection.insertOne(record);
    return Response.json(serializeExamSet(record), { status: 201 });
  } catch (error) {
    console.error("Failed to create question set", error);
    return Response.json({ error: "Không thể tạo question set." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !ObjectId.isValid(id)) {
      return Response.json({ error: "ID question set không hợp lệ." }, { status: 400 });
    }

    const collection = await getCollection("question_sets");
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return Response.json({ error: "Không tìm thấy question set." }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete question set", error);
    return Response.json({ error: "Không thể xóa question set." }, { status: 500 });
  }
}
