"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { useTemporaryUser } from "@/hooks/use-temporary-user";
import { getAnalytics, type AnalyticsResponse } from "@/lib/api/analytics-client";
import { LABELS } from "@/lib/constants/labels";
import styles from "./analytics.module.css";

export default function AnalyticsPage() {
  const router = useRouter();
  const identity = useTemporaryUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<Array<{ id: string, name: string }>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("ALL");
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  useEffect(() => {
    // Load subjects
    fetch("/api/subjects")
      .then(res => res.json())
      .then(payload => {
        if (payload.success) {
          setSubjects(payload.data.items || []);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (identity.isValid) {
      setLoading(true);
      setError("");
      const subId = selectedSubjectId === "ALL" ? undefined : selectedSubjectId;
      getAnalytics(identity.userId, subId)
        .then(res => {
          setData(res);
        })
        .catch(err => {
          setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi tải dữ liệu");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [identity.isValid, identity.userId, selectedSubjectId]);

  if (!identity.isValid) {
    return (
      <SidebarLayout>
        <div className="main-content">
          <div className={styles.emptyState}>
            <p>Vui lòng tạo/chọn User ID tạm thời để xem tiến độ.</p>
            <Link href="/exam/setup" className={styles.viewButton} style={{ marginTop: "1rem" }}>Tạo User</Link>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  const renderFeedback = () => {
    if (!data) return null;
    const { summary, failedQuestions } = data;
    const items: string[] = [];
    
    if (summary.totalAttempts < 2) {
      items.push("Hãy hoàn thành thêm bài thi để hệ thống phân tích tiến độ.");
    } else {
      if (summary.improvement !== null) {
        if (summary.improvement > 0) {
          items.push(`Bạn đã tăng ${summary.improvement} điểm so với lượt thi trước.`);
        } else if (summary.improvement < 0) {
          items.push(`Điểm gần nhất giảm ${Math.abs(summary.improvement)} điểm. Bạn nên xem lại các câu thường sai.`);
        }
      }
      if (failedQuestions.length > 0) {
        items.push(`Bạn có ${failedQuestions.length} câu đã sai ít nhất 2 lần.`);
      }
    }

    if (items.length === 0) return null;

    const isNegative = summary.improvement !== null && summary.improvement < 0;

    return (
      <div className={`${styles.feedbackSection} ${isNegative ? styles.negative : ""}`}>
        {items.map((it, idx) => (
          <div key={idx} className={styles.feedbackItem}>{it}</div>
        ))}
      </div>
    );
  };

  return (
    <SidebarLayout>
      <div className="main-content">
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>{LABELS.ANALYTICS}</h1>
            <div className={styles.filter}>
              <label htmlFor="subject-filter">Môn học:</label>
              <select 
                id="subject-filter"
                className={styles.select}
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
              >
                <option value="ALL">Tất cả môn</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>Đang tải dữ liệu...</div>
          ) : error ? (
            <div className={styles.emptyState}>{error}</div>
          ) : !data || data.summary.totalAttempts === 0 ? (
            <div className={styles.emptyState}>
              <p>Chưa có dữ liệu bài thi. Hãy làm bài để theo dõi tiến độ!</p>
            </div>
          ) : (
            <>
              {renderFeedback()}

              <div className={styles.grid}>
                <div className={styles.statCard}>
                  <div className={styles.statTitle}>Số lượt thi</div>
                  <div className={styles.statValue}>{data.summary.totalAttempts}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statTitle}>Điểm cao nhất</div>
                  <div className={styles.statValue}>{data.summary.highestScore ?? "-"}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statTitle}>Điểm trung bình</div>
                  <div className={styles.statValue}>{data.summary.averageScore ?? "-"}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statTitle}>Điểm gần nhất</div>
                  <div className={styles.statValue}>{data.summary.latestScore ?? "-"}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statTitle}>Tỷ lệ đúng</div>
                  <div className={styles.statValue}>{data.summary.correctRate !== null ? `${data.summary.correctRate}%` : "-"}</div>
                </div>
              </div>

              {data.failedQuestions.length > 0 && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Câu thường làm sai</h2>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Môn học</th>
                        <th>Nội dung (tóm tắt)</th>
                        <th>Số lần sai</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.failedQuestions.slice(0, 10).map((fq, idx) => {
                        let shortText = "N/A";
                        if (fq.content && fq.content.original) {
                           shortText = fq.content.original;
                           if (shortText.length > 60) shortText = shortText.substring(0, 60) + "...";
                        }
                        return (
                          <tr key={idx}>
                            <td>{fq.subjectName}</td>
                            <td>{shortText}</td>
                            <td>{fq.failedCount}</td>
                            <td>
                              <Link href={`/results/${fq.latestAttemptId}`} className={styles.viewButton}>
                                Xem lần gần nhất
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Lịch sử thi</h2>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Ngày thi</th>
                      <th>Môn học</th>
                      <th>Tên đề</th>
                      <th>Điểm</th>
                      <th>Kết quả</th>
                      <th>Thời gian</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map(item => {
                      const date = new Date(item.submittedAt).toLocaleDateString("vi-VN", { 
                        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                      });
                      const minutes = Math.floor(item.durationSeconds / 60);
                      const seconds = item.durationSeconds % 60;
                      const timeStr = `${minutes}p ${seconds}s`;
                      
                      return (
                        <tr key={item.id}>
                          <td>{date}</td>
                          <td>{item.subjectName}</td>
                          <td>{item.examSetTitle}</td>
                          <td><strong>{item.score}</strong></td>
                          <td>
                            <span style={{color: "#16a34a"}}>{item.correctCount}</span> / <span style={{color: "#dc2626"}}>{item.incorrectCount}</span> / <span style={{color: "#6b7280"}}>{item.unansweredCount}</span>
                          </td>
                          <td>{timeStr}</td>
                          <td>
                            <Link href={`/results/${item.id}`} className={styles.viewButton}>
                              Xem chi tiết
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
