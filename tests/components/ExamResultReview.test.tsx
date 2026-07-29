import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ExamResultReview } from "@/components/exam-results/ExamResultReview";
import type { SerializedExamResult } from "@/lib/api/exam-result-client";

import * as useTemporaryUserHook from "@/hooks/use-temporary-user";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/hooks/use-temporary-user", () => ({
  useTemporaryUser: vi.fn()
}));

describe("ExamResultReview", () => {
  const mockResult: SerializedExamResult = {
    attemptId: "attempt1",
    mode: "exam_set",
    subjectId: "subj1",
    sourceExamSetIds: ["set1"],
    status: "submitted",
    submittedAt: "2026-07-28T12:00:00Z",
    startedAt: "2026-07-28T11:00:00Z",
    durationSeconds: 3600,
    generatedAt: "2026-07-28T12:00:05Z",
    submitReason: "manual",
    summary: { score: 5, scoreScale: 10, correctCount: 1, partiallyCorrectCount: 0, incorrectCount: 1, unansweredCount: 0, totalQuestions: 2 },
    settings: { showTranslation: true, shuffleQuestions: false, shuffleOptions: false, scoringMode: "strict" },
    questions: [
      {
        questionId: "q1",
        order: 1,
        type: "single_choice",
        content: { original: "Q1" },
        sourceExamSetIds: ["set1"],
        userAnswer: { isFlagged: false },
        result: { status: "correct", earnedScore: 1, maxScore: 1 }
      },
      {
        questionId: "q2",
        order: 2,
        type: "single_choice",
        content: { original: "Q2" },
        sourceExamSetIds: ["set1"],
        userAnswer: { isFlagged: true },
        result: { status: "incorrect", earnedScore: 0, maxScore: 1 }
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTemporaryUserHook.useTemporaryUser).mockReturnValue({
      isValid: true,
      userId: "u1",
      inputValue: "u1",
      setInputValue: vi.fn(),
      stored: true,
      saveUserId: vi.fn(),
    });
  });

  it("renders summary statistics", () => {
    render(<ExamResultReview result={mockResult} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("/ 10")).toBeInTheDocument();
    expect(screen.getByText(/Thủ công/)).toBeInTheDocument();
  });

  it("filters questions based on filter selection", () => {
    render(<ExamResultReview result={mockResult} />);
    
    // Initially shows all
    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.getByText("Q2")).toBeInTheDocument();

    // Click "Chính xác"
    const correctFilterBtn = screen.getByRole("button", { name: /Chính xác/ });
    fireEvent.click(correctFilterBtn);

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.queryByText("Q2")).not.toBeInTheDocument();

    // Click "Đã đánh dấu"
    const flaggedFilterBtn = screen.getByRole("button", { name: /Đã đánh dấu/ });
    fireEvent.click(flaggedFilterBtn);

    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
    expect(screen.getByText("Q2")).toBeInTheDocument();
  });

  it("displays empty state when no questions match filter", () => {
    render(<ExamResultReview result={mockResult} />);
    const unansweredFilterBtn = screen.getByRole("button", { name: /Chưa trả lời/ });
    fireEvent.click(unansweredFilterBtn);

    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
    expect(screen.queryByText("Q2")).not.toBeInTheDocument();
    expect(screen.getByText("Không có câu hỏi nào thuộc nhóm này.")).toBeInTheDocument();
  });
});
