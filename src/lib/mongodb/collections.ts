import type { Collection } from "mongodb";
import type { ExamAttemptDocument } from "../../modules/exam-attempts/exam-attempt.types";
import type { ExamSetDocument, LegacyQuestionSetDocument } from "../../modules/exam-sets/exam-set.types";
import type { QuestionImportJobDocument } from "../../modules/imports/question-import.types";
import type { QuestionDocument } from "../../modules/questions/question.types";
import type { SubjectDocument } from "../../modules/subjects/subject.types";
import type { UserAnswerDocument } from "../../modules/user-answers/user-answer.types";
import type { UserDocument } from "../../modules/users/user.types";
import { getDatabase } from "./database";

export interface CollectionDocumentMap {
  users: UserDocument;
  subjects: SubjectDocument;
  exam_sets: ExamSetDocument;
  questions: QuestionDocument;
  exam_attempts: ExamAttemptDocument;
  user_answers: UserAnswerDocument;
  question_import_jobs: QuestionImportJobDocument;
  question_sets: LegacyQuestionSetDocument;
}

export async function getCollection<Name extends keyof CollectionDocumentMap>(
  name: Name,
): Promise<Collection<CollectionDocumentMap[Name]>> {
  const database = await getDatabase();
  return database.collection<CollectionDocumentMap[Name]>(name);
}
