import { ObjectId, type Collection, type Filter, type UpdateFilter } from "mongodb";
import type { SubjectDocument } from "./subject.types";

export class SubjectRepository {
  constructor(private readonly collection: Collection<SubjectDocument>) {}
  findById(id: SubjectDocument["_id"]) { return this.collection.findOne({ _id: id }); }
  findByCode(code: string) { return this.collection.findOne({ code }); }
  findPage(filter: Filter<SubjectDocument>, sort: Record<string, 1 | -1>, skip: number, limit: number) { return Promise.all([this.collection.find(filter).sort(sort).skip(skip).limit(limit).toArray(), this.collection.countDocuments(filter)]); }
  create(document: Omit<SubjectDocument, "_id">) { return this.collection.insertOne({ ...document, _id: new ObjectId() }); }
  update(id: SubjectDocument["_id"], update: UpdateFilter<SubjectDocument>) { return this.collection.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" }); }
}
