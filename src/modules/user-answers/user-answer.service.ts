import { ObjectId } from "mongodb";
import { ApiError } from "../../lib/api/response";
import type { ExamAttemptDocument } from "../exam-attempts/exam-attempt.types";
import { updateUserAnswerSchema } from "./user-answer.schema";
import { UserAnswerRepository } from "./user-answer.repository";

export class UserAnswerService {
  constructor(private readonly repository: UserAnswerRepository) {}

  async save(attempt: ExamAttemptDocument, input: unknown) {
    const value = updateUserAnswerSchema.parse(input);
    const question = attempt.questionSnapshots.find((item) => item.questionId.equals(new ObjectId(value.questionId)));
    if (!question) throw new ApiError("QUESTION_NOT_IN_ATTEMPT", "Câu hỏi không thuộc lượt làm bài.");
    if (value.selectedOptionIds !== undefined) {
      if (question.type === "true_false_group") throw new ApiError("INVALID_ANSWER", "Câu đúng/sai không nhận option.");
      const ids = new Set(question.options?.map((option) => option.id));
      if (new Set(value.selectedOptionIds).size !== value.selectedOptionIds.length || value.selectedOptionIds.some((id) => !ids.has(id))) throw new ApiError("INVALID_ANSWER", "Đáp án đã chọn không hợp lệ.");
      if (question.type === "single_choice" && value.selectedOptionIds.length > 1) throw new ApiError("INVALID_ANSWER", "Single choice chỉ được chọn một đáp án.");
    }
    if (value.statementAnswers !== undefined) {
      if (question.type !== "true_false_group") throw new ApiError("INVALID_ANSWER", "Câu lựa chọn không nhận statement answer.");
      const ids = new Set(question.statements?.map((statement) => statement.id));
      if (new Set(value.statementAnswers.map((item) => item.statementId)).size !== value.statementAnswers.length || value.statementAnswers.some((item) => !ids.has(item.statementId))) throw new ApiError("INVALID_ANSWER", "Statement answer không hợp lệ.");
    }
    const now = new Date();
    const update: Record<string, unknown> = { updatedAt: now };
    if (value.selectedOptionIds !== undefined) { update.selectedOptionIds = value.selectedOptionIds; update.answeredAt = now; }
    if (value.statementAnswers !== undefined) { update.statementAnswers = value.statementAnswers; update.answeredAt = now; }
    if (value.isFlagged !== undefined) update.isFlagged = value.isFlagged;
    const answer = await this.repository.upsert(attempt._id, question.questionId, attempt.userId, question.type, { $set: update });
    return answer;
  }
}
