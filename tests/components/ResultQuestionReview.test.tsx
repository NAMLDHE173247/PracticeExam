import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultQuestionReview } from "@/components/exam-results/ResultQuestionReview";
import type { SerializedExamResultQuestion } from "@/lib/api/exam-result-client";

describe("ResultQuestionReview", () => {
  const baseQuestion: SerializedExamResultQuestion = {
    questionId: "q1",
    order: 1,
    type: "single_choice",
    content: { original: "Test content", vi: "Test translation" },
    sourceExamSetIds: ["set1"],
    userAnswer: { isFlagged: false },
    result: { status: "correct", earnedScore: 1, maxScore: 1 }
  };

  it("renders basic question content and translation", () => {
    render(<ResultQuestionReview question={baseQuestion} index={0} showTranslation={true} />);
    expect(screen.getByText("Câu 1")).toBeInTheDocument();
    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(screen.getByText("Test translation")).toBeInTheDocument();
    expect(screen.getByText("Chính xác")).toBeInTheDocument();
    expect(screen.getByText("1 / 1 điểm")).toBeInTheDocument();
  });

  it("hides translation if showTranslation is false", () => {
    render(<ResultQuestionReview question={baseQuestion} index={0} showTranslation={false} />);
    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(screen.queryByText("Test translation")).not.toBeInTheDocument();
  });

  it("renders explanation if present", () => {
    const qWithExpl = {
      ...baseQuestion,
      explanation: { original: "Because A", vi: "Bởi vì A" }
    };
    render(<ResultQuestionReview question={qWithExpl} index={0} showTranslation={true} />);
    expect(screen.getByText("Giải thích")).toBeInTheDocument();
    expect(screen.getByText("Because A")).toBeInTheDocument();
    expect(screen.getByText("Bởi vì A")).toBeInTheDocument();
  });

  it("renders flagged status", () => {
    const qFlagged = { ...baseQuestion, userAnswer: { ...baseQuestion.userAnswer, isFlagged: true } };
    render(<ResultQuestionReview question={qFlagged} index={0} showTranslation={true} />);
    expect(screen.getByText("Đã đánh dấu")).toBeInTheDocument();
  });

  describe("ChoiceReview", () => {
    const choiceQ: SerializedExamResultQuestion = {
      ...baseQuestion,
      options: [
        { id: "A", label: "A", content: { original: "Opt A" } },
        { id: "B", label: "B", content: { original: "Opt B" } }
      ],
      userAnswer: { selectedOptionIds: ["A"], isFlagged: false },
      result: { status: "incorrect", earnedScore: 0, maxScore: 1, correctOptionIds: ["B"] }
    };

    it("renders options and highlights correctly", () => {
      render(<ResultQuestionReview question={choiceQ} index={0} showTranslation={false} />);
      expect(screen.getByText("Opt A")).toBeInTheDocument();
      expect(screen.getByText("Opt B")).toBeInTheDocument();
      
      // A is selected incorrectly
      expect(screen.getByText("Bạn chọn sai")).toBeInTheDocument();
      // B is correct answer
      expect(screen.getByText("Đáp án đúng")).toBeInTheDocument();
    });
  });

  describe("TrueFalseReview", () => {
    const tfQ: SerializedExamResultQuestion = {
      ...baseQuestion,
      type: "true_false_group",
      statements: [
        { id: "S1", content: { original: "Statement 1" } },
        { id: "S2", content: { original: "Statement 2" } }
      ],
      userAnswer: { statementAnswers: [{ statementId: "S1", answer: true }], isFlagged: false },
      result: { 
        status: "partial", 
        earnedScore: 0.5, 
        maxScore: 1, 
        correctStatementAnswers: [
          { statementId: "S1", answer: false }, 
          { statementId: "S2", answer: true }
        ] 
      }
    };

    it("renders true/false table and correctness", () => {
      render(<ResultQuestionReview question={tfQ} index={0} showTranslation={false} />);
      expect(screen.getByText("Statement 1")).toBeInTheDocument();
      expect(screen.getByText("Statement 2")).toBeInTheDocument();
      
      // S1 was answered true (incorrect)
      const saiElements = screen.getAllByText("Sai");
      expect(saiElements.length).toBeGreaterThan(0);
      
      // S2 was unanswered
      expect(screen.getByText("Chưa trả lời")).toBeInTheDocument();
    });
  });
});
