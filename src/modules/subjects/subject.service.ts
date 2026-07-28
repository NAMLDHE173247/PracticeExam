import { getCollection } from "../../lib/mongodb";
import { escapeRegExp } from "../../lib/api/query";
import { ApiError } from "../../lib/api/response";
import { SubjectRepository } from "./subject.repository";
import { createSubjectSchema, subjectQuerySchema, updateSubjectSchema } from "./subject.api.schema";
import type { SubjectDocument } from "./subject.types";

export class SubjectService {
  constructor(private readonly repository: SubjectRepository, private readonly examSets = getCollection("exam_sets")) {}
  async list(raw: Record<string, string | undefined>, page: number, pageSize: number) {
    const query = subjectQuerySchema.parse(raw);
    const filter = { ...(query.search ? { $or: [{ code: { $regex: escapeRegExp(query.search), $options: "i" } }, { name: { $regex: escapeRegExp(query.search), $options: "i" } }] } : {}), ...(query.isActive === undefined ? {} : { isActive: query.isActive }) };
    const [items, total] = await this.repository.findPage(filter, { [query.sort]: query.order === "desc" ? -1 : 1 }, (page - 1) * pageSize, pageSize);
    return { items, total };
  }
  async create(input: unknown) {
    const value = createSubjectSchema.parse(input);
    if (await this.repository.findByCode(value.code)) throw new ApiError("DUPLICATE_RESOURCE", "Mã môn đã tồn tại.");
    const now = new Date();
    const result = await this.repository.create({ ...value, isActive: true, createdAt: now, updatedAt: now });
    return this.repository.findById(result.insertedId);
  }
  async get(id: SubjectDocument["_id"]) { const subject = await this.repository.findById(id); if (!subject) throw new ApiError("NOT_FOUND", "Không tìm thấy môn học."); return subject; }
  async update(id: SubjectDocument["_id"], input: unknown) {
    const value = updateSubjectSchema.parse(input);
    if (!Object.keys(value).length) throw new ApiError("VALIDATION_ERROR", "Body không được rỗng.");
    if (value.code) { const duplicate = await this.repository.findByCode(value.code); if (duplicate && !duplicate._id.equals(id)) throw new ApiError("DUPLICATE_RESOURCE", "Mã môn đã tồn tại."); }
    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, item] of Object.entries(value)) update[key] = item;
    const result = await this.repository.update(id, { $set: update });
    if (!result) throw new ApiError("NOT_FOUND", "Không tìm thấy môn học.");
    return result;
  }
  async remove(id: SubjectDocument["_id"]) {
    await this.get(id);
    const hasExamSet = await (await this.examSets).countDocuments({ subjectId: id });
    const result = await this.repository.update(id, { $set: { isActive: false, updatedAt: new Date() } });
    return { subject: result, disabled: true, hadExamSets: hasExamSet > 0 };
  }
}

export async function getSubjectService() { return new SubjectService(new SubjectRepository(await getCollection("subjects"))); }
