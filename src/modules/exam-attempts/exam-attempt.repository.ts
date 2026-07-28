import { ObjectId, type ClientSession, type Collection, type Filter, type UpdateFilter } from "mongodb";
import type { ExamAttemptDocument } from "./exam-attempt.types";

export class ExamAttemptRepository {
  constructor(private readonly collection: Collection<ExamAttemptDocument>) {}
  findById(id: ObjectId, session?: ClientSession) { return this.collection.findOne({ _id: id }, { session }); }
  findOwned(id: ObjectId, userId: ObjectId, session?: ClientSession) { return this.collection.findOne({ _id: id, userId }, { session }); }
  create(document: Omit<ExamAttemptDocument, "_id">, session?: ClientSession) { return this.collection.insertOne({ ...document, _id: new ObjectId() }, { session }); }
  claimForSubmit(id: ObjectId, userId: ObjectId, now: Date, session?: ClientSession) {
    return this.collection.findOneAndUpdate({ _id: id, userId, status: "in_progress" }, { $set: { status: "submitting", updatedAt: now } }, { returnDocument: "after", session });
  }
  rollbackSubmitClaim(id: ObjectId, userId: ObjectId, session?: ClientSession) {
    return this.collection.findOneAndUpdate({ _id: id, userId, status: "submitting" }, { $set: { status: "in_progress", updatedAt: new Date() } }, { returnDocument: "after", session });
  }
  completeSubmittingAttempt(id: ObjectId, userId: ObjectId, update: UpdateFilter<ExamAttemptDocument>, session?: ClientSession) {
    return this.collection.findOneAndUpdate({ _id: id, userId, status: "submitting" }, update, { returnDocument: "after", session });
  }
  update(id: ObjectId, update: UpdateFilter<ExamAttemptDocument>, session?: ClientSession) { return this.collection.findOneAndUpdate({ _id: id }, update, { returnDocument: "after", session }); }
  updateOwned(id: ObjectId, userId: ObjectId, update: UpdateFilter<ExamAttemptDocument>, session?: ClientSession) { return this.collection.findOneAndUpdate({ _id: id, userId }, update, { returnDocument: "after", session }); }
  find(filter: Filter<ExamAttemptDocument>) { return this.collection.find(filter).toArray(); }
}
