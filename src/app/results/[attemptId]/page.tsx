"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getExamResult, type SerializedExamResult } from "@/lib/api/exam-result-client";
import { ApiClientError } from "@/lib/api/request";
import { useTemporaryUser } from "@/hooks/use-temporary-user";
import { ExamResultReview } from "@/components/exam-results/ExamResultReview";

export default function ResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  const identity = useTemporaryUser();
  const [result, setResult] = useState<SerializedExamResult | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => { 
    if (!identity.isValid) return; 
    
    const abortController = new AbortController();
    
    getExamResult(attemptId, identity.userId, abortController.signal)
      .then((data) => setResult(data))
      .catch((reason) => {
        if (reason.name === "AbortError") return;
        if (reason instanceof ApiClientError) {
          setError({ message: reason.message, code: reason.code });
        } else {
          setError({ message: reason instanceof Error ? reason.message : "Unable to load result." });
        }
      });
      
    return () => abortController.abort();
  }, [attemptId, identity.isValid, identity.userId]);

  if (!identity.isValid) {
    return (
      <main className="exam-message">
        <h1>Temporary identity required</h1>
        <Link className="primary-exam-button" href="/exam/setup">Go to exam setup</Link>
      </main>
    );
  }

  if (error) {
    let actionBtn = <button className="primary-exam-button" onClick={() => router.push("/exam/setup")}>Choose another exam</button>;
    
    if (error.code === "RESULT_NOT_READY") {
      actionBtn = <button className="primary-exam-button" onClick={() => window.location.reload()}>Thử lại</button>;
    } else if (error.code === "RESULT_SNAPSHOT_UNAVAILABLE") {
      // 409 data corruption, retry won't help much, maybe they want to start a new exam
    }

    return (
      <main className="exam-message">
        <h1>Không thể hiển thị kết quả</h1>
        <p role="alert">{error.message}</p>
        <div style={{ marginTop: "1rem" }}>{actionBtn}</div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="exam-message">
        <p>Đang tải kết quả...</p>
      </main>
    );
  }

  return (
    <main style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      <ExamResultReview result={result} />
    </main>
  );
}
