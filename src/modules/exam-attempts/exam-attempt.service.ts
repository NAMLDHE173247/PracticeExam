import { ObjectId, type Collection, type ClientSession } from "mongodb";
import { getCollection, runInTransaction } from "../../lib/mongodb";
import { ApiError, parseObjectId } from "../../lib/api/response";
import type { ExamSetDocument } from "../exam-sets/exam-set.types";
import type { QuestionDocument } from "../questions/question.types";
import type { UserDocument } from "../users/user.types";
import type { SubjectDocument } from "../subjects/subject.types";
import { UserAnswerRepository } from "../user-answers/user-answer.repository";
import { UserAnswerService } from "../user-answers/user-answer.service";
import { createExamAttemptSchema, type CreateExamAttemptInput } from "./exam-attempt.schema";
import { ExamAttemptRepository } from "./exam-attempt.repository";
import { createAnswerKeySnapshot, createAttemptSnapshot } from "./exam-attempt-snapshot";
import { selectExamSetQuestions, selectMixedQuestions } from "./exam-attempt-selection";
import { scoreAttempt } from "./exam-attempt-scoring";
import { serializeAttempt } from "./exam-attempt-serializer";
import type { ExamAttemptDocument, ExamAttemptSettings } from "./exam-attempt.types";

const DEFAULT_DURATION_MINUTES = 60;
const defaultSettings = (input?: CreateExamAttemptInput["settings"]): ExamAttemptSettings => ({
  shuffleQuestions: input?.shuffleQuestions ?? false,
  shuffleOptions: input?.shuffleOptions ?? false,
  showTranslation: input?.showTranslation ?? false,
  scoringMode: input?.scoringMode ?? "strict",
});

export class ExamAttemptService {
  private readonly answerService: UserAnswerService;

  constructor(
    private readonly attempts: ExamAttemptRepository,
    private readonly answers: UserAnswerRepository,
    private readonly users: Collection<UserDocument>,
    private readonly subjects: Collection<SubjectDocument>,
    private readonly examSets: Collection<ExamSetDocument>,
    private readonly questions: Collection<QuestionDocument>,
  ) {
    this.answerService = new UserAnswerService(answers);
  }

  private async activeUser(userId: ObjectId) {
    const user = await this.users.findOne({ _id: userId, isActive: true });
    if (!user) throw new ApiError("USER_NOT_FOUND", "User không tồn tại hoặc đã bị vô hiệu hóa.");
    return user;
  }

  private async activeSubject(subjectId: ObjectId) {
    const subject = await this.subjects.findOne({ _id: subjectId });
    if (!subject) throw new ApiError("INVALID_RELATION", "Môn học không tồn tại.");
    if (!subject.isActive) throw new ApiError("SUBJECT_INACTIVE", "Môn học không còn hoạt động.");
    return subject;
  }

  private async publishedExamSet(id: ObjectId) {
    const examSet = await this.examSets.findOne({ _id: id });
    if (!examSet) throw new ApiError("INVALID_RELATION", "Bộ đề không tồn tại.");
    if (examSet.status !== "published") throw new ApiError("EXAM_SET_NOT_PUBLISHED", "Bộ đề chưa được publish.");
    await this.activeSubject(examSet.subjectId);
    return examSet;
  }

  async create(input: unknown) {
    const value = createExamAttemptSchema.parse(input);
    const userId = parseObjectId(value.userId, "userId");
    await this.activeUser(userId);
    const settings = defaultSettings(value.settings);
    let subjectId: ObjectId;
    let examSetId: ObjectId | undefined;
    let sourceExamSetIds: ObjectId[];
    let questions: QuestionDocument[];
    let durationMinutes: number;

    if (value.mode === "exam_set") {
      examSetId = parseObjectId(value.examSetId, "examSetId");
      const examSet = await this.publishedExamSet(examSetId);
      subjectId = examSet.subjectId;
      sourceExamSetIds = [examSet._id];
      durationMinutes = examSet.durationMinutes ?? DEFAULT_DURATION_MINUTES;
      questions = await selectExamSetQuestions(this.questions, examSet, settings.shuffleQuestions);
    } else {
      subjectId = parseObjectId(value.subjectId, "subjectId");
      await this.activeSubject(subjectId);
      sourceExamSetIds = [...new Set(value.sourceExamSetIds.map((id) => parseObjectId(id, "sourceExamSetId").toHexString()))].map((id) => new ObjectId(id));
      const sourceSets = await this.examSets.find({ _id: { $in: sourceExamSetIds } }).toArray();
      if (sourceSets.length !== sourceExamSetIds.length) throw new ApiError("INVALID_RELATION", "Một hoặc nhiều bộ đề nguồn không tồn tại.");
      if (sourceSets.some((set) => !set.subjectId.equals(subjectId))) throw new ApiError("INVALID_RELATION", "Bộ đề nguồn phải thuộc môn đã chọn.");
      if (sourceSets.some((set) => set.status !== "published")) throw new ApiError("EXAM_SET_NOT_PUBLISHED", "Tất cả bộ đề nguồn phải được publish.");
      durationMinutes = value.durationMinutes;
      questions = await selectMixedQuestions(this.questions, subjectId, sourceExamSetIds, value.questionCount, settings.shuffleQuestions);
    }
    if (questions.length === 0) throw new ApiError("ATTEMPT_NO_QUESTIONS", "Không có câu hỏi hợp lệ.");

    const questionSnapshots = questions.map((question, index) => createAttemptSnapshot(question, index, settings.shuffleOptions, undefined, sourceExamSetIds));
    const answerKeySnapshots = questions.map(createAnswerKeySnapshot);
    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
    const now = new Date();
    const document: Omit<ExamAttemptDocument, "_id"> = {
      userId, mode: value.mode, subjectId, ...(examSetId ? { examSetId } : {}), sourceExamSetIds,
      questionIds: questions.map((question) => question._id), questionSnapshots, answerKeySnapshots,
      durationSeconds: durationMinutes * 60, status: "in_progress", startedAt, deadlineAt,
      lastSavedAt: now, scoreScale: 10, settings, createdAt: now, updatedAt: now,
    };
    const result = await this.attempts.create(document);
    return this.get(result.insertedId, userId, now);
  }

  private async ownedAttempt(id: ObjectId, userId: ObjectId) {
    const attempt = await this.attempts.findById(id);
    if (!attempt) throw new ApiError("ATTEMPT_NOT_FOUND", "Không tìm thấy lượt làm bài.");
    if (!attempt.userId.equals(userId)) throw new ApiError("ATTEMPT_FORBIDDEN", "Bạn không có quyền truy cập lượt làm bài này.");
    return attempt;
  }

  async get(id: ObjectId, userId: ObjectId, serverNow = new Date()) {
    await this.activeUser(userId);
    const attempt = await this.ownedAttempt(id, userId);
    return serializeAttempt(attempt, await this.answers.findByAttempt(id), serverNow);
  }

  async saveAnswer(id: ObjectId, input: unknown) {
    const parsedUserId = (input as { userId?: string } | null)?.userId;
    if (!parsedUserId) throw new ApiError("VALIDATION_ERROR", "userId là bắt buộc.");
    const userId = parseObjectId(parsedUserId, "userId");
    await this.activeUser(userId);
    const attempt = await this.ownedAttempt(id, userId);
    if (attempt.status !== "in_progress") throw new ApiError("ATTEMPT_NOT_IN_PROGRESS", "Lượt làm bài không còn ở trạng thái đang làm.");
    if (new Date() >= attempt.deadlineAt) throw new ApiError("ATTEMPT_TIME_EXPIRED", "Đã quá thời gian làm bài.");
    const answer = await this.answerService.save(attempt, input);
    await this.attempts.updateOwned(id, userId, { $set: { lastSavedAt: new Date(), updatedAt: new Date() } });
    return { questionId: answer?.questionId.toHexString(), saved: true };
  }

  private async alreadySubmitted(attempt: ExamAttemptDocument) {
    return serializeAttempt(attempt, await this.answers.findByAttempt(attempt._id), new Date());
  }

  async submit(id: ObjectId, input: unknown) {
    const userIdValue = (input as { userId?: string } | null)?.userId;
    if (!userIdValue) throw new ApiError("VALIDATION_ERROR", "userId là bắt buộc.");
    const userId = parseObjectId(userIdValue, "userId");
    await this.activeUser(userId);
    const current = await this.ownedAttempt(id, userId);
    if (current.status === "submitted" || current.status === "expired") return this.alreadySubmitted(current);
    if (current.status === "submitting") throw new ApiError("ATTEMPT_ALREADY_SUBMITTING", "Lượt làm bài đang được chấm.");
    if (current.status !== "in_progress") throw new ApiError("ATTEMPT_NOT_IN_PROGRESS", "Lượt làm bài không thể nộp.");
    const now = new Date();
    const claimed = await this.attempts.claimForSubmit(id, userId, now);
    if (!claimed) {
      const latest = await this.ownedAttempt(id, userId);
      if (latest.status === "submitted" || latest.status === "expired") return this.alreadySubmitted(latest);
      if (latest.status === "submitting") throw new ApiError("ATTEMPT_ALREADY_SUBMITTING", "Lượt làm bài đang được chấm.");
      throw new ApiError("CONFLICT", "Không thể claim lượt làm bài.");
    }
    try {
      const result = await runInTransaction(async (session) => this.completeSubmit(claimed, session, now));
      return serializeAttempt(result, await this.answers.findByAttempt(id), now);
    } catch (error) {
      const rollback = await this.attempts.rollbackSubmitClaim(id, userId);
      if (!rollback) {
        const latest = await this.attempts.findById(id);
        if (latest?.status === "submitting") console.error("Unable to rollback submitting attempt", id.toHexString());
      }
      throw error;
    }
  }

  private async completeSubmit(attempt: ExamAttemptDocument, session: ClientSession, now: Date) {
    const answers = await this.answers.findByAttempt(attempt._id, session);
    const scored = scoreAttempt(attempt, answers);
    for (const item of scored.gradings) {
      if (!item.answer) continue;
      await this.answers.updateForAttempt(attempt._id, item.key.questionId, attempt.userId, { $set: { grading: { isCorrect: item.result.isCorrect, isPartiallyCorrect: item.result.isPartiallyCorrect, earnedScore: item.result.earnedScore, maxScore: item.result.maxScore, ...(item.key.correctOptionIds ? { correctOptionIds: item.key.correctOptionIds } : {}), ...(item.key.correctStatementAnswers ? { correctStatementAnswers: item.key.correctStatementAnswers } : {}) }, updatedAt: now } }, session);
    }
    const status = now >= attempt.deadlineAt ? "expired" : "submitted";
    
    const resultSnapshot: ExamAttemptDocument["resultSnapshot"] = {
      generatedAt: now,
      summary: {
        score: scored.score,
        scoreScale: 10,
        correctCount: scored.correctCount,
        partiallyCorrectCount: scored.partiallyCorrectCount,
        incorrectCount: scored.incorrectCount,
        unansweredCount: scored.unansweredCount,
        totalQuestions: attempt.questionSnapshots.length,
      },
      items: attempt.questionSnapshots.map(snapshot => {
        const answerKeys = attempt.answerKeySnapshots.filter(key => key.questionId.equals(snapshot.questionId));
        if (answerKeys.length !== 1) throw new Error(`Invariant failed: Expected exactly 1 answer key for question ${snapshot.questionId.toHexString()}, found ${answerKeys.length}`);

        const gradings = scored.gradings.filter(g => g.key.questionId.equals(snapshot.questionId));
        if (gradings.length !== 1) throw new Error(`Invariant failed: Expected exactly 1 grading result for question ${snapshot.questionId.toHexString()}, found ${gradings.length}`);
        const grading = gradings[0];

        const answer = answers.find(a => a.questionId.equals(snapshot.questionId));

        return {
          questionId: snapshot.questionId,
          userAnswer: {
            selectedOptionIds: answer?.selectedOptionIds,
            statementAnswers: answer?.statementAnswers,
            isFlagged: answer?.isFlagged ?? false,
          },
          result: {
            status: grading.result.isCorrect ? "correct" : grading.result.isPartiallyCorrect ? "partial" : (!answer?.selectedOptionIds?.length && !answer?.statementAnswers?.length) ? "unanswered" : "incorrect",
            earnedScore: grading.result.earnedScore,
            maxScore: grading.result.maxScore,
          },
        };
      }),
    };

    const duplicateQuestionIds = resultSnapshot.items!.map(q => q.questionId.toHexString()).filter((item, index, array) => array.indexOf(item) !== index);
    if (duplicateQuestionIds.length > 0) {
      throw new Error(`Invariant failed: Duplicate question IDs in result snapshot: ${duplicateQuestionIds.join(", ")}`);
    }

    const updated = await this.attempts.completeSubmittingAttempt(attempt._id, attempt.userId, { $set: { status, submitReason: status === "expired" ? "timeout" : "manual", submittedAt: now, score: scored.score, correctCount: scored.correctCount, incorrectCount: scored.incorrectCount, unansweredCount: scored.unansweredCount, partiallyCorrectCount: scored.partiallyCorrectCount, totalEarnedPoints: scored.totalEarnedPoints, totalMaxPoints: scored.totalMaxPoints, lastSavedAt: now, updatedAt: now, resultSnapshot } }, session);
    if (!updated) throw new ApiError("ATTEMPT_NOT_FOUND", "Không tìm thấy lượt làm bài.");
    return updated;
  }
}

export async function getExamAttemptService() {
  return new ExamAttemptService(
    new ExamAttemptRepository(await getCollection("exam_attempts")),
    new UserAnswerRepository(await getCollection("user_answers")),
    await getCollection("users"), await getCollection("subjects"), await getCollection("exam_sets"), await getCollection("questions"),
  );
}
