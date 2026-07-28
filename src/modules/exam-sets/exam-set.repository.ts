import { ObjectId, type Collection, type Filter, type UpdateFilter } from "mongodb";
import type { ExamSetDocument } from "./exam-set.types";

export class ExamSetRepository {
  constructor(private readonly collection: Collection<ExamSetDocument>) {}
  findById(id: ExamSetDocument["_id"]) { return this.collection.findOne({ _id: id }); }
  findPage(filter: Filter<ExamSetDocument>, sort: Record<string, 1 | -1>, skip: number, limit: number) { return Promise.all([this.collection.find(filter).sort(sort).skip(skip).limit(limit).toArray(), this.collection.countDocuments(filter)]); }
  create(document: Omit<ExamSetDocument, "_id">) { return this.collection.insertOne({ ...document, _id: new ObjectId() }); }
  update(id: ExamSetDocument["_id"], update: UpdateFilter<ExamSetDocument>) { return this.collection.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" }); }
}
