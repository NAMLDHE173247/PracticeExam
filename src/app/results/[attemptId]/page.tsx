"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getExamAttempt, type ExamAttempt } from "@/lib/api/exam-attempt-client";
import { useTemporaryUser } from "@/hooks/use-temporary-user";

export default function ResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  const identity = useTemporaryUser();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!identity.isValid) return; void getExamAttempt(attemptId, identity.userId).then((result) => setAttempt(result.attempt)).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load result.")); }, [attemptId, identity.isValid, identity.userId]);
  if (!identity.isValid) return <main className="exam-message"><h1>Temporary identity required</h1><Link className="primary-exam-button" href="/exam/setup">Go to exam setup</Link></main>;
  if (error) return <main className="exam-message"><p role="alert">{error}</p><button className="primary-exam-button" onClick={() => router.push("/exam/setup")}>Choose another exam</button></main>;
  if (!attempt) return <main className="exam-message"><p>Loading result...</p></main>;
  return <main className="results-page"><Link href="/exam/setup" className="back-link">&larr; Choose another exam</Link><section className="results-card"><p className="eyebrow">Exam complete</p><h1>Your result</h1><div className="result-score"><strong>{attempt.score ?? 0}</strong><span>/ 10</span></div><p className="result-status">Status: <strong>{attempt.status === "expired" ? "Time expired" : "Submitted"}</strong> ({attempt.submitReason ?? "manual"})</p><div className="result-stats"><div><strong>{attempt.correctCount ?? 0}</strong><span>Correct</span></div><div><strong>{attempt.partiallyCorrectCount ?? 0}</strong><span>Partially correct</span></div><div><strong>{attempt.incorrectCount ?? 0}</strong><span>Incorrect</span></div><div><strong>{attempt.unansweredCount ?? 0}</strong><span>Unanswered</span></div></div>{attempt.submittedAt && <p className="result-date">Submitted {new Date(attempt.submittedAt).toLocaleString()}</p>}<div className="result-actions"><button className="primary-exam-button" onClick={() => router.push("/exam/setup")}>Take another exam</button><button onClick={() => router.push("/")}>Back to dashboard</button></div></section></main>;
}
