"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ExamStatus = "Published" | "Draft";

type ExamSet = {
  id: string;
  subject: string;
  title: string;
  questions: number;
  status: ExamStatus;
  updatedAt: string;
  accent: string;
};

const subjectColors: Record<string, string> = {
  "All subjects": "violet",
  ENW492c: "blue",
  WDU203c: "green",
  PRN232: "orange",
};

export default function Home() {
  const [examSets, setExamSets] = useState<ExamSet[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("All subjects");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newSubject, setNewSubject] = useState("ENW492c");
  const [newTitle, setNewTitle] = useState("");
  const [newQuestionCount, setNewQuestionCount] = useState("20");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadExamSets() {
      try {
        const response = await fetch("/api/question-sets");
        const payload = (await response.json()) as ExamSet[] | { error?: string };
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error("error" in payload ? payload.error : "Không thể tải dữ liệu.");
        }
        setExamSets(payload);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Không thể kết nối dữ liệu.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadExamSets();
  }, []);

  const filteredExamSets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return examSets.filter((examSet) => {
      const matchesSubject = selectedSubject === "All subjects" || examSet.subject === selectedSubject;
      const matchesSearch = !normalizedSearch || examSet.title.toLowerCase().includes(normalizedSearch);
      return matchesSubject && matchesSearch;
    });
  }, [examSets, searchTerm, selectedSubject]);

  const totalQuestions = examSets.reduce((total, examSet) => total + examSet.questions, 0);
  const publishedCount = examSets.filter((examSet) => examSet.status === "Published").length;
  const subjects = ["All subjects", "ENW492c", "WDU203c", "PRN232"];

  async function addExamSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    const questions = Number(newQuestionCount);
    if (!title || !Number.isFinite(questions) || questions < 1) return;

    try {
      const response = await fetch("/api/question-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: newSubject, title, questions }),
      });
      const payload = (await response.json()) as ExamSet | { error?: string };
      if (!response.ok || !("id" in payload)) {
        throw new Error("error" in payload ? payload.error : "Không thể tạo question set.");
      }
      setExamSets((current) => [payload, ...current]);
      setNewTitle("");
      setNewQuestionCount("20");
      setIsAdding(false);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể tạo question set.");
    }
  }

  async function removeExamSet(id: string) {
    try {
      const response = await fetch(`/api/question-sets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Không thể xóa question set.");
      setExamSets((current) => current.filter((examSet) => examSet.id !== id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể xóa question set.");
    }
  }

  return (
    <div className="dashboard-shell">
      <nav className="topbar" aria-label="Main navigation">
        <div className="nav-links">
          <a className="nav-link active" href="#question-sets">Question sets</a>
          <a className="nav-link" href="#subjects">Subjects</a>
          <a className="nav-link" href="#analytics">Analytics</a>
        </div>
      </nav>

      <main className="dashboard-main" id="top">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Content management</p>
            <h1>Question sets</h1>
            <p className="page-description">Create, organize and manage your practice questions.</p>
          </div>
          {errorMessage && <p className="api-error" role="alert">{errorMessage}</p>}
          <button className="add-button" type="button" onClick={() => setIsAdding(true)}>
            <span aria-hidden="true">+</span> New question set
          </button>
        </section>

        <section className="stats-grid" aria-label="Question set overview">
          <article className="stat-card">
            <div className="stat-icon violet-icon">▱</div>
            <div><p>Total question sets</p><strong>{examSets.length}</strong><span className="stat-note positive">+2 this month</span></div>
          </article>
          <article className="stat-card">
            <div className="stat-icon blue-icon">✓</div>
            <div><p>Published sets</p><strong>{publishedCount}</strong><span className="stat-note">Ready for students</span></div>
          </article>
          <article className="stat-card">
            <div className="stat-icon orange-icon">?</div>
            <div><p>Total questions</p><strong>{totalQuestions}</strong><span className="stat-note">Across all sets</span></div>
          </article>
        </section>

        <section className="workspace-card" id="question-sets">
          <div className="workspace-toolbar">
            <div>
              <h2>Your question sets</h2>
              <p>{filteredExamSets.length} sets found</p>
            </div>
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">Search question sets</span>
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by exam name..." />
            </label>
          </div>

          <div className="content-layout">
            <aside className="subject-sidebar" id="subjects">
              <p className="sidebar-label">Filter by subject</p>
              <div className="subject-list">
                {subjects.map((subject) => (
                  <button
                    className={`subject-filter ${selectedSubject === subject ? "selected" : ""}`}
                    type="button"
                    key={subject}
                    onClick={() => setSelectedSubject(subject)}
                  >
                    <span className={`subject-dot ${subjectColors[subject]}`} />
                    <span>{subject}</span>
                    <span className="subject-count">{subject === "All subjects" ? examSets.length : examSets.filter((examSet) => examSet.subject === subject).length}</span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Question set</th><th>Subject</th><th>Questions</th><th>Status</th><th>Last updated</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {!isLoading && filteredExamSets.map((examSet) => (
                    <tr key={examSet.id}>
                      <td><div className="set-title"><span className={`set-icon ${examSet.accent}`}>Q</span><strong>{examSet.title}</strong></div></td>
                      <td><span className={`subject-tag ${examSet.accent}`}>{examSet.subject}</span></td>
                      <td><span className="question-count">{examSet.questions}</span></td>
                      <td><span className={`status ${examSet.status.toLowerCase()}`}><span />{examSet.status}</span></td>
                      <td className="updated-at">{examSet.updatedAt}</td>
                      <td><button className="row-menu" type="button" onClick={() => removeExamSet(examSet.id)} aria-label={`Delete ${examSet.title}`}>•••</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {isLoading && <p className="empty-state">Đang tải dữ liệu từ MongoDB...</p>}
              {!isLoading && filteredExamSets.length === 0 && <p className="empty-state">No question sets match your filters.</p>}
            </div>
          </div>
        </section>
      </main>

      {isAdding && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIsAdding(false)}>
          <form className="modal-card" onSubmit={addExamSet}>
            <div className="modal-heading"><div><p className="eyebrow">New content</p><h2>Create question set</h2></div><button type="button" className="close-button" onClick={() => setIsAdding(false)} aria-label="Close">×</button></div>
            <label>Exam name<input autoFocus required value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="e.g. ENW492c Practice Exam" /></label>
            <label>Subject<select value={newSubject} onChange={(event) => setNewSubject(event.target.value)}><option>ENW492c</option><option>WDU203c</option><option>PRN232</option></select></label>
            <label>Number of questions<input required min="1" type="number" value={newQuestionCount} onChange={(event) => setNewQuestionCount(event.target.value)} /></label>
            <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setIsAdding(false)}>Cancel</button><button type="submit" className="add-button">Create set</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
