import Link from "next/link";
import type { ExamAttempt } from "@/lib/api/exam-attempt-client";

export function ExamHeader({ attempt, seconds, answered, onSubmit, disabled }: { attempt: ExamAttempt; seconds: number; answered: number; onSubmit: () => void; disabled: boolean }) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return <header className="exam-header"><Link href="/exam/setup" className="exam-title">Practice exam</Link><span className="exam-progress">Answered <strong>{answered}/{attempt.questions.length}</strong></span><span className={`exam-timer ${seconds <= 60 ? "critical" : seconds <= 300 ? "warning" : ""}`} aria-live={seconds % 60 === 0 ? "polite" : "off"}>Time left <strong>{minutes}:{remaining}</strong></span><button className="submit-exam-button" type="button" onClick={onSubmit} disabled={disabled}>Submit exam</button></header>;
}
