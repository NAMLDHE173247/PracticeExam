"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AutosaveStatus } from "@/components/exam/AutosaveStatus";
import { ExamHeader } from "@/components/exam/ExamHeader";
import { QuestionNavigator } from "@/components/exam/QuestionNavigator";
import { QuestionRenderer } from "@/components/exam/QuestionRenderer";
import { SubmitExamDialog } from "@/components/exam/SubmitExamDialog";
import { useExamAttempt } from "@/hooks/use-exam-attempt";
import { useTemporaryUser } from "@/hooks/use-temporary-user";

export default function ExamPage() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const identity = useTemporaryUser();
  const exam = useExamAttempt(params.attemptId, identity.userId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const question = exam.attempt?.questions[exam.currentIndex];
  const answer = question ? exam.answers[question.questionId] ?? { isFlagged: false } : { isFlagged: false };
  const answeredCount = useMemo(() => Object.values(exam.answers).filter((item) => item.selectedOptionIds?.length || item.statementAnswers?.length).length, [exam.answers]);
  const flaggedCount = useMemo(() => Object.values(exam.answers).filter((item) => item.isFlagged).length, [exam.answers]);

  useEffect(() => { if (exam.attempt && (exam.attempt.status === "submitted" || exam.attempt.status === "expired")) router.replace(`/results/${params.attemptId}`); }, [exam.attempt, params.attemptId, router]);

  if (!identity.isValid) return <main className="exam-message"><h1>Temporary identity required</h1><p>Set up a development user before opening this attempt.</p><Link className="primary-exam-button" href="/exam/setup">Go to exam setup</Link></main>;
  if (exam.isLoading && !exam.attempt) return <main className="exam-message"><p>Loading your exam…</p></main>;
  if (exam.loadError && !exam.attempt) return <main className="exam-message"><h1>Unable to load exam</h1><p role="alert">{exam.loadError}</p><button className="primary-exam-button" onClick={exam.retryLoad}>Retry load</button></main>;
  if (!exam.attempt || !question) return <main className="exam-message"><p>No questions are available for this attempt.</p></main>;

  const selectAnswer = (value: { selectedOptionIds?: string[]; statementAnswers?: Array<{ statementId: string; answer: boolean }> }) => exam.updateAnswer(question.questionId, value);
  const clearAnswer = () => exam.updateAnswer(question.questionId, question.type === "true_false_group" ? { statementAnswers: [] } : { selectedOptionIds: [] });
  const toggleFlag = () => exam.updateFlag(question.questionId, !answer.isFlagged);
  const submitAndShowResult = async () => { const result = await exam.submit(); if (result) { setDialogOpen(false); router.replace(`/results/${params.attemptId}`); } };
  return <main className="realistic-exam-page">
    <ExamHeader attempt={exam.attempt} seconds={exam.countdown} answered={answeredCount} onSubmit={() => setDialogOpen(true)} disabled={exam.isSubmitting || exam.attempt.status !== "in_progress"} />
    {exam.submitError && <div className="exam-global-error" role="alert">{exam.submitError}</div>}
    <div className="exam-body"><section className="exam-question-panel" aria-labelledby="question-heading"><div className="question-kicker"><span>Question {exam.currentIndex + 1} of {exam.attempt.questions.length}</span><AutosaveStatus state={exam.saveState} hasPending={exam.hasPendingSaves} /></div><h1 id="question-heading" className="sr-only">Question {exam.currentIndex + 1}</h1><QuestionRenderer question={question} answer={answer} showTranslation={exam.attempt.settings.showTranslation} disabled={exam.countdown === 0 || exam.isSubmitting} onAnswer={selectAnswer} /><div className="question-actions"><button type="button" onClick={clearAnswer} disabled={exam.countdown === 0}>Clear answer</button><button type="button" className={answer.isFlagged ? "flagged-button" : ""} onClick={toggleFlag} disabled={exam.countdown === 0}>{answer.isFlagged ? "⚑ Flagged" : "⚐ Mark for review"}</button></div><div className="exam-navigation"><button type="button" disabled={exam.currentIndex === 0} onClick={() => exam.selectQuestion(exam.currentIndex - 1)}>Previous</button><button type="button" disabled={exam.currentIndex === exam.attempt.questions.length - 1} onClick={() => exam.selectQuestion(exam.currentIndex + 1)}>Next</button></div>{exam.saveState === "failed" && <p className="save-warning" role="alert">Some changes have not been saved. Your local answer is preserved; retry by changing it.</p>}</section><QuestionNavigator questions={exam.attempt.questions} answers={exam.answers} currentIndex={exam.currentIndex} onSelect={exam.selectQuestion} /></div>
    <SubmitExamDialog open={dialogOpen} answered={answeredCount} total={exam.attempt.questions.length} flagged={flaggedCount} isSubmitting={exam.isSubmitting} error={exam.submitError} onCancel={() => setDialogOpen(false)} onConfirm={submitAndShowResult} />
  </main>;
}
