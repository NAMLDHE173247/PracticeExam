"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExamAttempt, getExamAttempt, saveExamAnswer, submitExamAttempt } from "@/lib/api/exam-attempt-client";
import { useExamCountdown } from "./use-exam-countdown";

type LocalAnswer = { selectedOptionIds?: string[]; statementAnswers?: Array<{ statementId: string; answer: boolean }>; isFlagged: boolean };
type SaveState = "idle" | "saving" | "saved" | "failed";
const questionStorageKey = (id: string) => `practice_exam_current_question_${id}`;

export function useExamAttempt(attemptId: string, userId: string) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPendingSaves, setHasPendingSaves] = useState(false);
  const sequence = useRef(0);
  const pending = useRef<Record<string, LocalAnswer>>({});
  const timers = useRef<Record<string, number>>({});
  const countdown = useExamCountdown(attempt?.deadlineAt);

  const applyPayload = useCallback((next: ExamAttempt) => {
    setAttempt(next);
    const restored: Record<string, LocalAnswer> = {};
    for (const answer of next.answers) restored[answer.questionId] = { selectedOptionIds: answer.selectedOptionIds, statementAnswers: answer.statementAnswers, isFlagged: answer.isFlagged };
    setAnswers(restored);
    const savedIndex = Number(window.sessionStorage.getItem(questionStorageKey(attemptId)) ?? "0");
    setCurrentIndex(Number.isInteger(savedIndex) ? Math.min(Math.max(savedIndex, 0), Math.max(next.questions.length - 1, 0)) : 0);
  }, [attemptId]);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true); setLoadError("");
    try { applyPayload((await getExamAttempt(attemptId, userId)).attempt); }
    catch (error) { if ((error as DOMException).name !== "AbortError") setLoadError(error instanceof Error ? error.message : "Unable to load the exam."); }
    finally { setIsLoading(false); }
  }, [applyPayload, attemptId, userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!attempt || attempt.status !== "submitting") return;
    const timer = window.setInterval(() => { void load(); }, 1500);
    return () => window.clearInterval(timer);
  }, [attempt, load]);

  const saveNow = useCallback(async (questionId: string, value: LocalAnswer) => {
    const requestSequence = ++sequence.current;
    setSaveState("saving");
    try {
      await saveExamAnswer(attemptId, { userId, questionId, ...value });
      if (requestSequence === sequence.current) { setSaveState("saved"); setHasPendingSaves(false); }
    } catch (error) { if (requestSequence === sequence.current) { setSaveState("failed"); setHasPendingSaves(false); } throw error; }
  }, [attemptId, userId]);

  const updateAnswer = useCallback((questionId: string, value: Omit<LocalAnswer, "isFlagged">) => {
    setAnswers((current) => {
      const next = { ...current, [questionId]: { ...current[questionId], ...value, isFlagged: current[questionId]?.isFlagged ?? false } };
      pending.current[questionId] = next[questionId];
      setHasPendingSaves(true);
      return next;
    });
    if (timers.current[questionId]) window.clearTimeout(timers.current[questionId]);
    timers.current[questionId] = window.setTimeout(() => {
      const next = pending.current[questionId];
      if (next) { delete pending.current[questionId]; void saveNow(questionId, next).catch(() => undefined); }
    }, 650);
  }, [saveNow]);

  const updateFlag = useCallback((questionId: string, isFlagged: boolean) => {
    setAnswers((current) => { const next = { ...current, [questionId]: { ...current[questionId], isFlagged } }; pending.current[questionId] = next[questionId]; setHasPendingSaves(true); return next; });
    if (timers.current[questionId]) window.clearTimeout(timers.current[questionId]);
    timers.current[questionId] = window.setTimeout(() => { const next = pending.current[questionId]; if (next) { delete pending.current[questionId]; void saveNow(questionId, next).catch(() => undefined); } }, 650);
  }, [saveNow]);

  const flush = useCallback(async () => {
    const items = Object.entries(pending.current);
    pending.current = {};
    await Promise.all(items.map(async ([questionId, value]) => { if (timers.current[questionId]) window.clearTimeout(timers.current[questionId]); await saveNow(questionId, value); }));
  }, [saveNow]);

  const submit = useCallback(async () => {
    if (isSubmitting || !attempt || attempt.status === "submitted" || attempt.status === "expired") return null;
    setIsSubmitting(true); setSubmitError("");
    try { await flush(); const result = (await submitExamAttempt(attemptId, userId)).attempt; setAttempt(result); return result; }
    catch (error) { setSubmitError(error instanceof Error ? error.message : "Unable to submit the exam."); return null; }
    finally { setIsSubmitting(false); }
  }, [attempt, attemptId, flush, isSubmitting, userId]);

  useEffect(() => {
    if (countdown !== 0 || !attempt || attempt.status !== "in_progress") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void submit();
  }, [attempt, countdown, submit]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (Object.keys(pending.current).length || saveState === "failed") { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const selectQuestion = useCallback((index: number) => { setCurrentIndex(index); window.sessionStorage.setItem(questionStorageKey(attemptId), String(index)); }, [attemptId]);
  return { attempt, answers, currentIndex, selectQuestion, updateAnswer, updateFlag, countdown, saveState, loadError, isLoading, isSubmitting, submitError, submit, retryLoad: load, hasPendingSaves };
}
