import { randomInt } from "node:crypto";
import type { Collection } from "mongodb";
import type { ExamSetDocument } from "../exam-sets/exam-set.types";
import type { QuestionDocument } from "../questions/question.types";
import { ApiError } from "../../lib/api/response";

export type RandomIndex = (maxExclusive: number) => number;

export function shuffle<T>(values: T[], randomIndex: RandomIndex = (max) => randomInt(max)): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export async function selectExamSetQuestions(
  questions: Collection<QuestionDocument>,
  examSet: ExamSetDocument,
  shuffleQuestions: boolean,
  randomIndex?: RandomIndex,
): Promise<QuestionDocument[]> {
  const items = await questions.find({ subjectId: examSet.subjectId, examSetIds: examSet._id, status: "published" }).sort({ createdAt: 1, _id: 1 }).toArray();
  if (items.length === 0) throw new ApiError("ATTEMPT_NO_QUESTIONS", "Bộ đề chưa có câu hỏi hợp lệ.");
  return shuffleQuestions ? shuffle(items, randomIndex) : items;
}

export async function selectMixedQuestions(
  questions: Collection<QuestionDocument>,
  subjectId: ExamSetDocument["subjectId"],
  sourceExamSetIds: ExamSetDocument["_id"][],
  questionCount: number,
  shuffleQuestions: boolean,
  randomIndex?: RandomIndex,
): Promise<QuestionDocument[]> {
  const items = await questions.find({ subjectId, examSetIds: { $in: sourceExamSetIds }, status: "published" }).sort({ createdAt: 1, _id: 1 }).toArray();
  const unique = [...new Map(items.map((item) => [item._id.toHexString(), item])).values()];
  if (questionCount > unique.length) throw new ApiError("INSUFFICIENT_QUESTIONS", "Số câu yêu cầu vượt quá số câu hợp lệ thực tế.");
  const selected = shuffleQuestions ? shuffle(unique, randomIndex) : unique;
  return selected.slice(0, questionCount);
}
