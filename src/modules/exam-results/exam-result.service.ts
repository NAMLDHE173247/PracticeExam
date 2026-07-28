import { ObjectId } from "mongodb";
import { getCollection } from "../../lib/mongodb";
import { ApiError } from "../../lib/api/response";
import { ExamAttemptRepository } from "../exam-attempts/exam-attempt.repository";
import { serializeResult } from "./exam-result-serializer";

export class ExamResultService {
  constructor(private readonly attempts: ExamAttemptRepository) {}

  async getResult(attemptId: ObjectId, userId: ObjectId) {
    const attempt = await this.attempts.findById(attemptId);
    if (!attempt) throw new ApiError("ATTEMPT_NOT_FOUND", "Không tìm thấy lượt làm bài.");
    if (!attempt.userId.equals(userId)) throw new ApiError("ATTEMPT_FORBIDDEN", "Bạn không có quyền truy cập kết quả này.");

    return serializeResult(attempt);
  }
}

export async function getExamResultService() {
  return new ExamResultService(new ExamAttemptRepository(await getCollection("exam_attempts")));
}
