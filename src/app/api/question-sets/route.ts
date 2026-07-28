import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExamStatus = "Published" | "Draft";

type ExamSetDocument = {
  _id?: ObjectId;
  subject: string;
  title: string;
  questions: number;
  status: ExamStatus;
  updatedAt: string;
  accent: string;
  createdAt: Date;
};

const seedExamSets: Omit<ExamSetDocument, "_id">[] = [
  { subject: "ENW492c", title: "ENW492c Practice Exam", questions: 50, status: "Published", updatedAt: "Today, 09:42", accent: "blue", createdAt: new Date("2026-06-20") },
  { subject: "ENW492c", title: "ENW492c Revision Set", questions: 35, status: "Published", updatedAt: "Yesterday", accent: "blue", createdAt: new Date("2026-06-19") },
  { subject: "WDU203c", title: "WDU203c Practice Exam", questions: 40, status: "Draft", updatedAt: "Jun 18, 2026", accent: "green", createdAt: new Date("2026-06-18") },
  { subject: "PRN232", title: "PRN232 Practice Exam", questions: 30, status: "Published", updatedAt: "Jun 15, 2026", accent: "orange", createdAt: new Date("2026-06-15") },
  { subject: "WDU203c", title: "WDU203c Revision Set", questions: 25, status: "Draft", updatedAt: "Jun 12, 2026", accent: "green", createdAt: new Date("2026-06-12") },
];

function serializeExamSet(examSet: ExamSetDocument) {
  return {
    id: examSet._id?.toString() ?? "",
    subject: examSet.subject,
    title: examSet.title,
    questions: examSet.questions,
    status: examSet.status,
    updatedAt: examSet.updatedAt,
    accent: examSet.accent,
  };
}

async function getCollection() {
  const database = await getDatabase();
  return database.collection<ExamSetDocument>("question_sets");
}

export async function GET() {
  try {
    const collection = await getCollection();
    const existingCount = await collection.countDocuments();

    if (existingCount === 0) {
      await collection.insertMany(seedExamSets);
    }

    const examSets = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return Response.json(examSets.map(serializeExamSet));
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
    const document: Omit<ExamSetDocument, "_id"> = {
      subject,
      title,
      questions,
      status: "Draft",
      updatedAt: "Just now",
      accent,
      createdAt: new Date(),
    };
    const collection = await getCollection();
    const result = await collection.insertOne(document);
    return Response.json(serializeExamSet({ ...document, _id: result.insertedId }), { status: 201 });
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

    const collection = await getCollection();
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
