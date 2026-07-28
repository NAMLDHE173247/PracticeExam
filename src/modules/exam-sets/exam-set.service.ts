import { getCollection } from "../../lib/mongodb";
import { escapeRegExp } from "../../lib/api/query";
import { ApiError, parseObjectId } from "../../lib/api/response";
import { ExamSetRepository } from "./exam-set.repository";
import { createExamSetSchema, examSetQuerySchema, updateExamSetSchema } from "./exam-set.api.schema";
import type { ExamSetDocument } from "./exam-set.types";

export class ExamSetService {
  constructor(private readonly repository: ExamSetRepository, private readonly subjects = getCollection("subjects"), private readonly questions = getCollection("questions")) {}
  async list(raw: Record<string, string | undefined>, page: number, pageSize: number) {
    const query = examSetQuerySchema.parse(raw);
    const filter = { ...(query.subjectId ? { subjectId: parseObjectId(query.subjectId, "subjectId") } : {}), ...(query.status ? { status: query.status } : {}), ...(query.search ? { $or: [{ title: { $regex: escapeRegExp(query.search), $options: "i" } }, { description: { $regex: escapeRegExp(query.search), $options: "i" } }] } : {}) };
    const [items, total] = await this.repository.findPage(filter, { [query.sort]: query.order === "desc" ? -1 : 1 }, (page - 1) * pageSize, pageSize);
    const subjectCollection = await this.subjects;
    const subjectIds = [...new Set(items.map((item) => item.subjectId.toHexString()))].map((id) => parseObjectId(id));
    const subjects = await subjectCollection.find({ _id: { $in: subjectIds } }).project({ code: 1, name: 1 }).toArray();
    const subjectMap = new Map(subjects.map((subject) => [subject._id.toHexString(), subject]));
    return { items: items.map((item) => ({ ...item, subject: subjectMap.get(item.subjectId.toHexString()) ?? null })), total };
  }
  async get(id: ExamSetDocument["_id"]) { const item = await this.repository.findById(id); if (!item) throw new ApiError("NOT_FOUND", "Không tìm thấy bộ đề."); return item; }
  private async activeSubject(id: ExamSetDocument["subjectId"]) { const subject = await (await this.subjects).findOne({ _id: id }); if (!subject) throw new ApiError("INVALID_RELATION", "Môn học không tồn tại."); if (!subject.isActive) throw new ApiError("CONFLICT", "Không thể dùng môn học đã vô hiệu hóa."); return subject; }
  async create(input: unknown) {
    const value = createExamSetSchema.parse(input); if (value.status === "published") throw new ApiError("CONFLICT", "Không thể publish bộ đề chưa có câu hỏi."); const subjectId = parseObjectId(value.subjectId, "subjectId"); await this.activeSubject(subjectId);
    const now = new Date(); const result = await this.repository.create({ subjectId, title: value.title, description: value.description, durationMinutes: value.defaultDurationMinutes, passingScore: value.passingScore, status: value.status ?? "draft", questionCount: 0, createdAt: now, updatedAt: now });
    return this.get(result.insertedId);
  }
  async update(id: ExamSetDocument["_id"], input: unknown) {
    const current = await this.get(id); const value = updateExamSetSchema.parse(input); if (!Object.keys(value).length) throw new ApiError("VALIDATION_ERROR", "Body không được rỗng."); const actualQuestionCount = await (await this.questions).countDocuments({ examSetIds: id, status: { $ne: "archived" } });
    if (value.subjectId && !current.subjectId.equals(parseObjectId(value.subjectId, "subjectId"))) { if (actualQuestionCount > 0) throw new ApiError("CONFLICT", "Không thể đổi môn khi bộ đề đã có câu hỏi."); await this.activeSubject(parseObjectId(value.subjectId, "subjectId")); }
    if (value.status === "published" && actualQuestionCount < 1) throw new ApiError("CONFLICT", "Không thể publish bộ đề chưa có câu hỏi.");
    const update: Record<string, unknown> = { updatedAt: new Date() }; if (value.subjectId) update.subjectId = parseObjectId(value.subjectId, "subjectId"); if ("title" in value) update.title = value.title; if ("description" in value) update.description = value.description ?? undefined; if ("defaultDurationMinutes" in value) update.durationMinutes = value.defaultDurationMinutes ?? undefined; if ("passingScore" in value) update.passingScore = value.passingScore ?? undefined; if (value.status) update.status = value.status;
    const result = await this.repository.update(id, { $set: update }); if (!result) throw new ApiError("NOT_FOUND", "Không tìm thấy bộ đề."); return result;
  }
  async remove(id: ExamSetDocument["_id"]) { await this.get(id); const result = await this.repository.update(id, { $set: { status: "archived", updatedAt: new Date() } }); return { examSet: result, archived: true }; }
  async listQuestions(id: ExamSetDocument["_id"], page: number, pageSize: number) { await this.get(id); const collection = await this.questions; const [items, total] = await Promise.all([collection.find({ examSetIds: id }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(), collection.countDocuments({ examSetIds: id })]); return { items, total }; }
}

export async function getExamSetService() { return new ExamSetService(new ExamSetRepository(await getCollection("exam_sets"))); }
