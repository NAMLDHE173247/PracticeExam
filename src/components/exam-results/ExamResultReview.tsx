import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createExamAttempt } from "../../lib/api/exam-attempt-client";
import { useTemporaryUser } from "@/hooks/use-temporary-user";
import type { SerializedExamResult } from "../../lib/api/exam-result-client";
import { ResultQuestionReview } from "./ResultQuestionReview";
import { statusMap, type ResultFilter, uiIcons } from "./result-status";
import styles from "./ExamResultReview.module.css";

interface ExamResultReviewProps {
  result: SerializedExamResult;
}

export function ExamResultReview({ result }: ExamResultReviewProps) {
  const router = useRouter();
  const identity = useTemporaryUser();
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [isRetaking, setIsRetaking] = useState(false);
  const [includeUnanswered, setIncludeUnanswered] = useState(true);
  const [retakeError, setRetakeError] = useState("");
  
  const handleRetake = async (mode: "full" | "incorrect_only") => {
    if (!identity.isValid) return;
    setIsRetaking(true);
    setRetakeError("");
    try {
      const res = await createExamAttempt({
        userId: identity.userId,
        mode: "retake",
        sourceAttemptId: result.attemptId,
        retakeMode: mode,
        includeUnanswered,
        settings: result.settings
      });
      router.push(`/exam/${res.attempt.id}`);
    } catch (e) {
      setRetakeError(e instanceof Error ? e.message : "Có lỗi xảy ra khi tạo lượt làm lại.");
      setIsRetaking(false);
    }
  };
  
  const showTranslation = result.settings.showTranslation;
  const questions = useMemo(() => {
    return [...result.questions].sort((a, b) => a.order - b.order);
  }, [result.questions]);

  const counts = useMemo(() => {
    const c: Record<ResultFilter, number> = {
      all: questions.length,
      correct: 0,
      partial: 0,
      incorrect: 0,
      unanswered: 0,
      flagged: 0,
    };
    
    questions.forEach(q => {
      c[q.result.status]++;
      if (q.userAnswer.isFlagged) {
        c.flagged++;
      }
    });
    
    return c;
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((question) => {
      if (filter === "all") return true;
      if (filter === "flagged") return question.userAnswer.isFlagged;
      return question.result.status === filter;
    });
  }, [questions, filter]);

  const ClockIcon = uiIcons.time;

  return (
    <div className={styles.container}>
      <section className={styles.summaryCard}>
        <h1 className={styles.title}>Kết quả bài thi</h1>
        <div className={styles.scoreCircle}>
          <span className={styles.scoreValue}>{result.summary.score}</span>
          <span className={styles.scoreScale}>/ {result.summary.scoreScale}</span>
        </div>
        
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{counts.correct}</span>
            <span className={styles.statLabel}>Chính xác</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{counts.partial}</span>
            <span className={styles.statLabel}>Đúng một phần</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{counts.incorrect}</span>
            <span className={styles.statLabel}>Sai</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{counts.unanswered}</span>
            <span className={styles.statLabel}>Bỏ trống</span>
          </div>
        </div>

        <div className={styles.metaInfo}>
          <span>
            Trạng thái: <strong>{result.status === "expired" ? "Hết giờ" : "Đã nộp"}</strong> ({result.submitReason === "timeout" ? "Tự động" : "Thủ công"})
          </span>
          {result.submittedAt && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ClockIcon size={14} aria-hidden="true" />
              {new Date(result.submittedAt).toLocaleString()}
            </span>
          )}
        </div>
      </section>

      <section className={styles.filterSection}>
        <h2 className={styles.filterHeader}>Xem lại câu hỏi</h2>
        <div className={styles.filterButtons} role="group" aria-label="Lọc câu hỏi">
          {(Object.keys(statusMap) as ResultFilter[]).map((f) => {
            const meta = statusMap[f];
            const Icon = meta.icon;
            return (
              <button
                key={f}
                className={styles.filterButton}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                <Icon size={16} aria-hidden="true" />
                {meta.label}
                <span className={styles.filterCount}>{counts[f]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.questionsList}>
        {filteredQuestions.length === 0 ? (
          <div className={styles.emptyState}>
            Không có câu hỏi nào thuộc nhóm này.
          </div>
        ) : (
          filteredQuestions.map((q, idx) => (
            <ResultQuestionReview
              key={q.questionId}
              question={q}
              index={q.order - 1} // order is 1-based, we want 0-based for displaying 1-based again?
              // Wait, order is 1-based. So if we pass index=0, it shows Câu 1.
              showTranslation={showTranslation}
            />
          ))
        )}
      </section>

      <div className={styles.actions}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          <button 
            className={styles.secondaryButton} 
            onClick={() => handleRetake("full")}
            disabled={isRetaking}
          >
            Làm lại toàn bộ đề
          </button>
          
          <button 
            className={styles.primaryButton}
            onClick={() => handleRetake("incorrect_only")}
            disabled={isRetaking || (counts.incorrect + counts.partial === 0 && (!includeUnanswered || counts.unanswered === 0))}
          >
            Làm lại câu sai
          </button>
          
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#555" }}>
            <input 
              type="checkbox" 
              checked={includeUnanswered} 
              onChange={(e) => setIncludeUnanswered(e.target.checked)} 
              disabled={isRetaking}
            />
            Bao gồm câu chưa trả lời
          </label>
        </div>
        {retakeError && <div style={{ color: "#a04444", fontSize: "14px", marginTop: "10px" }}>{retakeError}</div>}
      </div>
    </div>
  );
}
