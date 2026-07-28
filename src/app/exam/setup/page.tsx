"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createExamAttempt, type AttemptSettings } from "@/lib/api/exam-attempt-client";
import { loadExamSets, loadSubjects, type ExamSet, type Subject } from "@/lib/api/question-import-client";
import { useTemporaryUser } from "@/hooks/use-temporary-user";

const initialSettings: Required<AttemptSettings> = { shuffleQuestions: false, shuffleOptions: false, showTranslation: true, scoringMode: "strict" };

export default function ExamSetupPage() {
  const router = useRouter();
  const identity = useTemporaryUser();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examSets, setExamSets] = useState<ExamSet[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [examSetId, setExamSetId] = useState("");
  const [mode, setMode] = useState<"exam_set" | "mixed">("exam_set");
  const [sourceExamSetIds, setSourceExamSetIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void loadSubjects().then(setSubjects).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load subjects.")).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!subjectId) return;
    const controller = new AbortController();
    void loadExamSets(subjectId, controller.signal).then((items) => { setExamSets(items.filter((item) => item.status === "published")); setExamSetId(""); setSourceExamSetIds([]); }).catch((reason) => { if (reason.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Unable to load exam sets."); });
    return () => controller.abort();
  }, [subjectId]);

  const selectedExamSet = examSets.find((item) => item._id === examSetId);
  const toggleSource = (id: string) => setSourceExamSetIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const changeSubject = (value: string) => { setSubjectId(value); setExamSets([]); setExamSetId(""); setSourceExamSetIds([]); setError(""); };
  const changeMode = (next: "exam_set" | "mixed") => { setMode(next); setError(""); };
  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setSettings((current) => ({ ...current, [key]: value }));

  async function startExam(event: FormEvent) {
    event.preventDefault();
    if (!identity.isValid) { setError("Enter a valid MongoDB user ID first."); return; }
    setIsStarting(true); setError("");
    try {
      const input = mode === "exam_set" ? { userId: identity.userId, mode, examSetId, settings } : { userId: identity.userId, mode, subjectId, sourceExamSetIds, questionCount, durationMinutes, settings };
      const result = await createExamAttempt(input);
      router.push(`/exam/${result.attempt.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to start exam."); setIsStarting(false); }
  }

  return <main className="exam-setup-page">
    <div className="exam-page-top"><Link href="/" className="back-link">← Dashboard</Link><span className="temporary-badge">Temporary development identity</span></div>
    <header className="exam-setup-heading"><p className="eyebrow">Practice exam</p><h1>Set up your exam</h1><p>Choose a published exam set and configure your attempt.</p></header>
    {!identity.stored && <section className="identity-card"><h2>Temporary development identity</h2><p>Authentication is not enabled yet. Enter a MongoDB user ID for this local test session. This is not real security.</p><label>MongoDB user ID<input placeholder="24-character ObjectId" value={identity.inputValue} onChange={(event) => identity.setInputValue(event.target.value)} onBlur={() => identity.saveUserId(identity.inputValue)} /></label></section>}
    {identity.stored && <p className="identity-note">Using temporary development identity: <code>{identity.userId}</code></p>}
    {error && <p className="exam-error" role="alert">{error}</p>}
    <form className="setup-card" onSubmit={startExam}>
      <div className="mode-tabs" role="tablist"><button type="button" className={mode === "exam_set" ? "selected" : ""} onClick={() => changeMode("exam_set")}>One exam set</button><button type="button" className={mode === "mixed" ? "selected" : ""} onClick={() => changeMode("mixed")}>Mixed exam</button></div>
      <div className="setup-grid">
        <label>Subject<select required value={subjectId} disabled={loading} onChange={(event) => changeSubject(event.target.value)}><option value="">Select subject</option>{subjects.filter((item) => item.isActive).map((item) => <option key={item._id} value={item._id}>{item.code} — {item.name}</option>)}</select></label>
        {mode === "exam_set" ? <label>Published exam set<select required value={examSetId} onChange={(event) => setExamSetId(event.target.value)}><option value="">Select exam set</option>{examSets.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></label> : <fieldset><legend>Published exam sets</legend><div className="setup-check-list">{examSets.map((item) => <label key={item._id}><input type="checkbox" checked={sourceExamSetIds.includes(item._id)} onChange={() => toggleSource(item._id)} />{item.title} <small>{item.questionCount} questions</small></label>)}</div></fieldset>}
        {mode === "mixed" && <><label>Number of questions<input required type="number" min="1" max="200" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} /></label><label>Duration (minutes)<input required type="number" min="1" max="600" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} /></label></>}
      </div>
      {mode === "exam_set" && selectedExamSet && <div className="exam-details"><strong>{selectedExamSet.title}</strong><span>{selectedExamSet.questionCount} questions</span><span>{selectedExamSet.durationMinutes ?? 60} minutes</span></div>}
      <fieldset className="settings-fieldset"><legend>Exam settings</legend><div className="settings-grid">{(["shuffleQuestions", "shuffleOptions", "showTranslation"] as const).map((key) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={(event) => updateSetting(key, event.target.checked)} />{key === "shuffleQuestions" ? "Shuffle questions" : key === "shuffleOptions" ? "Shuffle options" : "Show Vietnamese translation"}</label>)}<label>Scoring mode<select value={settings.scoringMode} onChange={(event) => updateSetting("scoringMode", event.target.value as "strict" | "partial")}><option value="strict">Strict</option><option value="partial">Partial</option></select></label></div></fieldset>
      <button className="primary-exam-button" disabled={isStarting || !identity.isValid || !subjectId || (mode === "exam_set" ? !examSetId : sourceExamSetIds.length === 0)}>{isStarting ? "Starting…" : "Start exam"}</button>
    </form>
    <p className="technical-debt">Technical debt: replace temporary identity with authentication before production use.</p>
  </main>;
}
