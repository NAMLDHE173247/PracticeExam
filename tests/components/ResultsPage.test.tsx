import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ResultsPage from "@/app/results/[attemptId]/page";
import * as examResultClient from "@/lib/api/exam-result-client";
import { ApiClientError } from "@/lib/api/request";
import * as useTemporaryUserHook from "@/hooks/use-temporary-user";

vi.mock("next/navigation", () => ({
  useParams: () => ({ attemptId: "attempt123" }),
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/hooks/use-temporary-user", () => ({
  useTemporaryUser: vi.fn()
}));

vi.mock("@/lib/api/exam-result-client", () => ({
  getExamResult: vi.fn()
}));

describe("ResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows identity error if invalid", () => {
    vi.mocked(useTemporaryUserHook.useTemporaryUser).mockReturnValue({
      isValid: false,
      userId: "",
      inputValue: "",
      setInputValue: vi.fn(),
      stored: false,
      saveUserId: vi.fn(),
    });
    
    render(<ResultsPage />);
    expect(screen.getByText("Yêu cầu danh tính tạm thời")).toBeInTheDocument();
  });

  it("fetches and renders result successfully", async () => {
    vi.mocked(useTemporaryUserHook.useTemporaryUser).mockReturnValue({
      isValid: true,
      userId: "u1",
      inputValue: "u1",
      setInputValue: vi.fn(),
      stored: true,
      saveUserId: vi.fn(),
    });

    const mockResult = {
      id: "attempt123",
      status: "submitted",
      summary: { score: 10, scoreScale: 10 },
      settings: { showTranslation: true },
      questions: []
    } as any;

    vi.mocked(examResultClient.getExamResult).mockResolvedValue(mockResult);

    render(<ResultsPage />);
    expect(screen.getByText("Đang tải kết quả...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Kết quả bài thi")).toBeInTheDocument();
    });
  });

  it("handles RESULT_NOT_READY error specifically", async () => {
    vi.mocked(useTemporaryUserHook.useTemporaryUser).mockReturnValue({
      isValid: true,
      userId: "u1",
      inputValue: "u1",
      setInputValue: vi.fn(),
      stored: true,
      saveUserId: vi.fn(),
    });

    const err = new ApiClientError("RESULT_NOT_READY", "Not ready yet", undefined, 409);
    vi.mocked(examResultClient.getExamResult).mockRejectedValue(err);

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByText("Không thể hiển thị kết quả")).toBeInTheDocument();
    });
    
    expect(screen.getByText("Not ready yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("handles generic ApiClientError", async () => {
    vi.mocked(useTemporaryUserHook.useTemporaryUser).mockReturnValue({
      isValid: true,
      userId: "u1",
      inputValue: "u1",
      setInputValue: vi.fn(),
      stored: true,
      saveUserId: vi.fn(),
    });

    const err = new ApiClientError("ATTEMPT_NOT_FOUND", "Attempt not found", undefined, 404);
    vi.mocked(examResultClient.getExamResult).mockRejectedValue(err);

    render(<ResultsPage />);

    await waitFor(() => {
      expect(screen.getByText("Attempt not found")).toBeInTheDocument();
    });
    
    expect(screen.getByRole("button", { name: "Chọn đề thi khác" })).toBeInTheDocument();
  });
});
