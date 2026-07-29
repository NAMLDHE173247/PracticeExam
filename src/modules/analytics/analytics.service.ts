import { ObjectId } from "mongodb";
import { getCollection } from "../../lib/mongodb";
import type { ExamAttemptDocument } from "../exam-attempts/exam-attempt.types";
import type { SubjectDocument } from "../subjects/subject.types";
import type { ExamSetDocument } from "../exam-sets/exam-set.types";
import { parseObjectId } from "../../lib/api/response";

export interface AnalyticsSummary {
  totalAttempts: number;
  averageScore: number | null;
  highestScore: number | null;
  latestScore: number | null;
  correctRate: number | null;
  improvement: number | null;
}

export interface AnalyticsHistoryItem {
  id: string;
  submittedAt: string;
  subjectName: string;
  examSetTitle: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  partiallyCorrectCount: number;
  durationSeconds: number;
}

export interface AnalyticsFailedQuestion {
  questionId: string;
  subjectName: string;
  failedCount: number;
  content: any; // snapshot content
  latestAttemptId: string;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  history: AnalyticsHistoryItem[];
  failedQuestions: AnalyticsFailedQuestion[];
}

export async function getAnalytics(userId: string, subjectId?: string): Promise<AnalyticsResponse> {
  const userObjId = parseObjectId(userId, "userId");
  const filter: any = {
    userId: userObjId,
    status: { $in: ["submitted", "expired"] },
    resultSnapshot: { $exists: true }
  };
  
  if (subjectId && subjectId !== "ALL") {
    filter.subjectId = parseObjectId(subjectId, "subjectId");
  }

  const attemptsCollection = await getCollection("exam_attempts");
  const attempts = await attemptsCollection.find(filter).sort({ submittedAt: -1 }).toArray();

  const summary: AnalyticsSummary = {
    totalAttempts: attempts.length,
    averageScore: null,
    highestScore: null,
    latestScore: null,
    correctRate: null,
    improvement: null
  };

  const history: AnalyticsHistoryItem[] = [];
  const failedQuestionsMap = new Map<string, { count: number, content: any, latestAttemptId: string, subjectId: string }>();

  if (attempts.length > 0) {
    let totalScore = 0;
    let totalCorrect = 0;
    let totalQuestions = 0;
    let highest = -1;

    // Load subjects and exam sets to resolve names
    const subjectsCollection = await getCollection("subjects");
    const examSetsCollection = await getCollection("exam_sets");
    
    const subjectIds = [...new Set(attempts.map(a => a.subjectId.toHexString()))].map(id => new ObjectId(id));
    const subjects = await subjectsCollection.find({ _id: { $in: subjectIds } }).toArray();
    const subjectMap = new Map(subjects.map(s => [s._id.toHexString(), s.name]));

    const examSetIds = [...new Set(attempts.filter(a => a.mode === "exam_set" && a.examSetId).map(a => a.examSetId!.toHexString()))].map(id => new ObjectId(id));
    const examSets = await examSetsCollection.find({ _id: { $in: examSetIds } }).toArray();
    const examSetMap = new Map(examSets.map(e => [e._id.toHexString(), e.title]));

    for (let i = 0; i < attempts.length; i++) {
      const a = attempts[i];
      const score = a.score || 0;
      totalScore += score;
      if (score > highest) highest = score;

      const cCount = a.correctCount || 0;
      const tCount = a.resultSnapshot?.summary?.totalQuestions || a.questionSnapshots?.length || 0;
      totalCorrect += cCount;
      totalQuestions += tCount;

      let examSetTitle = "Bài thi tổng hợp";
      if (a.mode === "exam_set" && a.examSetId) {
        examSetTitle = examSetMap.get(a.examSetId.toHexString()) || "Không rõ";
      } else if (a.mode === "retake") {
        examSetTitle = "Làm lại: " + (a.examSetId ? examSetMap.get(a.examSetId.toHexString()) || "Không rõ" : "Bài thi tổng hợp");
      }

      history.push({
        id: a._id.toHexString(),
        submittedAt: (a.submittedAt || a.updatedAt || new Date()).toISOString(),
        subjectName: subjectMap.get(a.subjectId.toHexString()) || "Không rõ",
        examSetTitle,
        score,
        correctCount: cCount,
        incorrectCount: a.incorrectCount || 0,
        unansweredCount: a.unansweredCount || 0,
        partiallyCorrectCount: a.partiallyCorrectCount || 0,
        durationSeconds: a.durationSeconds || 0
      });

      // Aggregate failed questions
      if (a.resultSnapshot && a.resultSnapshot.items) {
        for (const item of a.resultSnapshot.items) {
          if (item.result.status === "incorrect" || item.result.status === "partial") {
            const qIdStr = item.questionId.toHexString();
            const existing = failedQuestionsMap.get(qIdStr);
            if (existing) {
              existing.count += 1;
              // keep the latest snapshot (attempts are sorted descending by submittedAt, so first seen is latest)
            } else {
              const snapshot = a.questionSnapshots.find((q: any) => q.questionId.toHexString() === qIdStr);
              if (snapshot) {
                failedQuestionsMap.set(qIdStr, {
                  count: 1,
                  content: snapshot.content,
                  latestAttemptId: a._id.toHexString(),
                  subjectId: a.subjectId.toHexString()
                });
              }
            }
          }
        }
      }
    }

    summary.averageScore = Number((totalScore / attempts.length).toFixed(2));
    summary.highestScore = Number(highest.toFixed(2));
    summary.latestScore = Number((attempts[0].score || 0).toFixed(2));
    summary.correctRate = totalQuestions > 0 ? Number(((totalCorrect / totalQuestions) * 100).toFixed(1)) : 0;

    // Calculate improvement
    if (attempts.length >= 2) {
      const latest = attempts[0];
      const previous = attempts.find((a, idx) => idx > 0 && a.subjectId.toHexString() === latest.subjectId.toHexString());
      if (previous) {
        summary.improvement = Number(((latest.score || 0) - (previous.score || 0)).toFixed(2));
      }
    }
    
    // Sort failed questions
    const failedArr: AnalyticsFailedQuestion[] = [];
    for (const [qId, data] of failedQuestionsMap.entries()) {
      if (data.count >= 2) {
        failedArr.push({
          questionId: qId,
          subjectName: subjectMap.get(data.subjectId) || "Không rõ",
          failedCount: data.count,
          content: data.content,
          latestAttemptId: data.latestAttemptId
        });
      }
    }
    
    failedArr.sort((a, b) => b.failedCount - a.failedCount);
    return { summary, history, failedQuestions: failedArr };
  }

  return { summary, history, failedQuestions: [] };
}
