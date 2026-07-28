import { ObjectId, type ClientSession, type Collection, type UpdateFilter } from "mongodb";
import type { QuestionImportJobDocument } from "./question-import.types";

export class QuestionImportRepository {
  constructor(private readonly collection: Collection<QuestionImportJobDocument>) {}
  findById(id: ObjectId) { return this.collection.findOne({ _id: id }); }
  create(document: Omit<QuestionImportJobDocument, "_id">) { return this.collection.insertOne({ ...document, _id: new ObjectId() }); }
  claimReady(id: ObjectId, tokenHash: string) { return this.collection.findOneAndUpdate({ _id: id, status: "ready", confirmTokenHash: tokenHash }, { $set: { status: "importing", updatedAt: new Date() } }, { returnDocument: "after" }); }
  update(id: ObjectId, update: UpdateFilter<QuestionImportJobDocument>, session?: ClientSession) { return this.collection.findOneAndUpdate({ _id: id }, update, { returnDocument: "after", session }); }
  cancel(id: ObjectId) { return this.collection.findOneAndUpdate({ _id: id, status: { $in: ["ready", "failed"] } }, { $set: { status: "cancelled", updatedAt: new Date() } }, { returnDocument: "after" }); }
}
