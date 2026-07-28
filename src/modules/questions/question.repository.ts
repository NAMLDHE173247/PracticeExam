import { ObjectId, type ClientSession, type Collection, type Filter, type UpdateFilter } from "mongodb";
import type { QuestionDocument } from "./question.types";

export class QuestionRepository {
  constructor(private readonly collection: Collection<QuestionDocument>) {}
  findById(id: QuestionDocument["_id"]) { return this.collection.findOne({ _id: id }); }
  findByHash(subjectId: QuestionDocument["subjectId"], contentHash: string, excludeId?: QuestionDocument["_id"]) { return this.collection.findOne({ subjectId, contentHash, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); }
  findPage(filter: Filter<QuestionDocument>, sort: Record<string, 1 | -1>, skip: number, limit: number) { return Promise.all([this.collection.find(filter).sort(sort).skip(skip).limit(limit).toArray(), this.collection.countDocuments(filter)]); }
  create(document: Omit<QuestionDocument, "_id">, session?: ClientSession) { return this.collection.insertOne({ ...document, _id: new ObjectId() }, { session }); }
  update(id: QuestionDocument["_id"], update: UpdateFilter<QuestionDocument>, session?: ClientSession) { return this.collection.findOneAndUpdate({ _id: id }, update, { returnDocument: "after", session }); }
  addExamSet(id: QuestionDocument["_id"], examSetId: QuestionDocument["examSetIds"][number], session?: ClientSession) { return this.collection.updateOne({ _id: id, examSetIds: { $ne: examSetId } }, { $addToSet: { examSetIds: examSetId }, $set: { updatedAt: new Date() } }, { session }); }
  removeExamSet(id: QuestionDocument["_id"], examSetId: QuestionDocument["examSetIds"][number], session?: ClientSession) { return this.collection.updateOne({ _id: id, examSetIds: examSetId }, { $pull: { examSetIds: examSetId }, $set: { updatedAt: new Date() } }, { session }); }
}
