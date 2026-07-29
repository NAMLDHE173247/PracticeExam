import React from "react";
import type { SerializedExamResultQuestion } from "../../modules/exam-results/exam-result.types";
import { statusMap, uiIcons } from "./result-status";
import styles from "./ResultQuestionReview.module.css";

interface ResultQuestionReviewProps {
  question: SerializedExamResultQuestion;
  index: number;
  showTranslation: boolean;
}

export function ResultQuestionReview({ question, index, showTranslation }: ResultQuestionReviewProps) {
  const statusMeta = statusMap[question.result.status];
  const StatusIcon = statusMeta.icon;
  const FlagIcon = statusMap.flagged.icon;
  const ExplanationIcon = uiIcons.explanation;

  return (
    <div className={styles.questionCard} data-testid={`question-review-${question.questionId}`}>
      <div className={styles.questionHeader}>
        <div className={styles.questionMeta}>
          <span className={styles.questionOrder}>Câu {index + 1}</span>
          <span className={`${styles.statusBadge} ${styles[statusMeta.className]}`}>
            <StatusIcon size={16} aria-hidden="true" />
            {statusMeta.label}
          </span>
          {question.userAnswer.isFlagged && (
            <span className={`${styles.statusBadge} ${styles[statusMap.flagged.className]}`}>
              <FlagIcon size={16} aria-hidden="true" />
              {statusMap.flagged.label}
            </span>
          )}
        </div>
        <div className={styles.scoreBadge}>
          <uiIcons.score size={16} aria-hidden="true" />
          <span>{question.result.earnedScore} / {question.result.maxScore} điểm</span>
        </div>
      </div>

      <div className={styles.content}>
        <div>{question.content.original}</div>
        {showTranslation && question.content.vi && (
          <div className={styles.translation}>{question.content.vi}</div>
        )}
      </div>

      {(question.type === "single_choice" || question.type === "multiple_choice") && (
        <ChoiceReview question={question} showTranslation={showTranslation} />
      )}

      {question.type === "true_false_group" && (
        <TrueFalseReview question={question} showTranslation={showTranslation} />
      )}

      {question.explanation && (
        <div className={styles.explanationBox}>
          <div className={styles.explanationHeader}>
            <ExplanationIcon size={18} aria-hidden="true" />
            <span>Giải thích</span>
          </div>
          <div className={styles.explanationContent}>
            <div>{question.explanation.original}</div>
            {showTranslation && question.explanation.vi && (
              <div className={styles.translation}>{question.explanation.vi}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceReview({ question, showTranslation }: { question: SerializedExamResultQuestion; showTranslation: boolean }) {
  const options = question.options ?? [];
  const selectedIds = new Set(question.userAnswer.selectedOptionIds ?? []);
  const correctIds = new Set(question.result.correctOptionIds ?? []);

  return (
    <div className={styles.optionsList}>
      {options.map((option) => {
        const isSelected = selectedIds.has(option.id);
        const isCorrectAnswer = correctIds.has(option.id);

        let itemClass = styles.isUnselected;
        if (isSelected && isCorrectAnswer) itemClass = styles.isSelectedCorrect;
        else if (isSelected && !isCorrectAnswer) itemClass = styles.isSelectedIncorrect;
        else if (!isSelected && isCorrectAnswer) itemClass = styles.isCorrectAnswer;

        return (
          <div key={option.id} className={`${styles.optionItem} ${itemClass}`}>
            <div className={styles.optionHeader}>
              <span className={styles.optionLabel}>{option.label}.</span>
              <div className={styles.optionBadges}>
                {isSelected && isCorrectAnswer && <span className={`${styles.badge} ${styles.badgeYouSelected}`}>Bạn đã chọn</span>}
                {isSelected && !isCorrectAnswer && <span className={`${styles.badge} ${styles.badgeIncorrectSelection}`}>Bạn chọn sai</span>}
                {!isSelected && isCorrectAnswer && <span className={`${styles.badge} ${styles.badgeCorrectAnswer}`}>Đáp án đúng</span>}
                {!isSelected && !isCorrectAnswer && <span className={`${styles.badge} ${styles.badgeNotSelected}`}>Không được chọn</span>}
              </div>
            </div>
            <div className={styles.optionContent}>
              <div>{option.content.original}</div>
              {showTranslation && option.content.vi && (
                <div className={styles.translation}>{option.content.vi}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrueFalseReview({ question, showTranslation }: { question: SerializedExamResultQuestion; showTranslation: boolean }) {
  const statements = question.statements ?? [];
  const userAnswersMap = new Map(question.userAnswer.statementAnswers?.map(s => [s.statementId, s.answer]) ?? []);
  const correctAnswersMap = new Map(question.result.correctStatementAnswers?.map(s => [s.statementId, s.answer]) ?? []);

  return (
    <table className={styles.trueFalseTable}>
      <thead>
        <tr>
          <th>Nhận định</th>
          <th>Bạn chọn</th>
          <th>Đáp án</th>
          <th>Kết quả</th>
        </tr>
      </thead>
      <tbody>
        {statements.map((stmt) => {
          const userAnswer = userAnswersMap.get(stmt.id);
          const correctAnswer = correctAnswersMap.get(stmt.id);
          const isAnswered = userAnswer !== undefined;
          const isCorrect = isAnswered && userAnswer === correctAnswer;
          
          let rowClass = styles.rowUnanswered;
          if (isAnswered) {
            rowClass = isCorrect ? styles.rowCorrect : styles.rowIncorrect;
          }

          return (
            <tr key={stmt.id} className={`${styles.tfRow} ${rowClass}`}>
              <td>
                <div className={styles.tfContent}>
                  <div>{stmt.content.original}</div>
                  {showTranslation && stmt.content.vi && (
                    <div className={styles.translation}>{stmt.content.vi}</div>
                  )}
                </div>
              </td>
              <td>{isAnswered ? (userAnswer ? "Đúng" : "Sai") : "-"}</td>
              <td>{correctAnswer !== undefined ? (correctAnswer ? "Đúng" : "Sai") : "-"}</td>
              <td>
                {!isAnswered ? (
                  <span className={`${styles.badge} ${styles.badgeNotSelected}`}>Chưa trả lời</span>
                ) : isCorrect ? (
                  <span className={`${styles.badge} ${styles.badgeCorrectAnswer}`}>Chính xác</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeIncorrectSelection}`}>Sai</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
