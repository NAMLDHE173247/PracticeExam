import { ObjectId, type ClientSession, type Collection, type Filter, type UpdateFilter } from "mongodb";
import type { UserAnswerDocument } from "./user-answer.types";
import type { QuestionType } from "../questions/question.types";

export class UserAnswerRepository {
  constructor(private readonly collection: Collection<UserAnswerDocument>) {}
  findByAttempt(attemptId: ObjectId, session?: ClientSession) { return this.collection.find({ attemptId }, { session }).toArray(); }
  findByQuestion(attemptId: ObjectId, questionId: ObjectId, session?: ClientSession) { return this.collection.findOne({ attemptId, questionId }, { session }); }
  upsert(attemptId: ObjectId, questionId: ObjectId, userId: ObjectId, questionType: QuestionType, update: UpdateFilter<UserAnswerDocument>, session?: ClientSession) {
    return this.collection.findOneAndUpdate({ attemptId, questionId }, { $set: { ...update.$set, attemptId, questionId, userId, questionType, updatedAt: new Date() }, $setOnInsert: { _id: new ObjectId() } }, { upsert: true, returnDocument: "after", session });
  }
  updateForAttempt(attemptId: ObjectId, questionId: ObjectId, userId: ObjectId, update: UpdateFilter<UserAnswerDocument>, session?: ClientSession) { return this.collection.findOneAndUpdate({ attemptId, questionId, userId }, update, { returnDocument: "after", session }); }
  find(filter: Filter<UserAnswerDocument>) { return this.collection.find(filter).toArray(); }
}
