"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { LABELS } from "@/lib/constants/labels";

type ExamSetStatus = "draft" | "published" | "archived";

type ExamSet = {
  _id: string;
  subjectId: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  passingScore?: number;
  status: ExamSetStatus;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  subject?: { code: string; name: string };
};

type Subject = {
  _id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const accentOptions = ["blue", "green", "orange", "violet"];

function accentFromSubjectCode(code: string) {
  if (!code) return "violet";
  const hash = [...code].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );
  return accentOptions[hash % accentOptions.length];
}

export default function Home() {
  const [examSets, setExamSets] = useState<ExamSet[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  
  const [isEditingExamSet, setIsEditingExamSet] = useState<ExamSet | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [isUpdatingExamSet, setIsUpdatingExamSet] = useState(false);

  const [isLoadingExamSets, setIsLoadingExamSets] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [isCreatingExamSet, setIsCreatingExamSet] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [subjectErrorMessage, setSubjectErrorMessage] = useState("");

  useEffect(() => {
    async function loadExamSets() {
      try {
        const response = await fetch("/api/exam-sets?page=1&pageSize=100&sort=createdAt&order=desc");
        const payload = (await response.json()) as ApiSuccess<ExamSet[]> | { error?: { message: string } };
        if (!response.ok || !("success" in payload) || !payload.success) {
          throw new Error("error" in payload ? payload.error?.message : "Không thể tải dữ liệu.");
        }
        setExamSets(payload.data);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Không thể kết nối dữ liệu.");
      } finally {
        setIsLoadingExamSets(false);
      }
    }

    async function loadSubjects() {
      try {
        const response = await fetch("/api/subjects?isActive=true&page=1&pageSize=100&sort=name&order=asc");
        const payload = await response.json() as ApiSuccess<Subject[]> | { error?: { message: string } };
        if (!response.ok || !("success" in payload) || !payload.success) {
          throw new Error("error" in payload ? payload.error?.message : "Không thể tải dữ liệu môn học.");
        }
        setSubjects(payload.data);
        setNewSubjectId((current) => {
          if (current && payload.data.some((subject) => subject._id === current)) {
            return current;
          }
          return payload.data[0]?._id ?? "";
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingSubjects(false);
      }
    }

    void loadExamSets();
    void loadSubjects();
  }, []);

  const filteredExamSets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return examSets.filter((examSet) => {
      if (examSet.status === "archived") return false;
      const matchesSubject = selectedSubjectId === "ALL" || examSet.subjectId === selectedSubjectId;
      const matchesSearch = !normalizedSearch || examSet.title.toLowerCase().includes(normalizedSearch);
      return matchesSubject && matchesSearch;
    });
  }, [examSets, searchTerm, selectedSubjectId]);

  const totalQuestions = examSets.reduce((total, examSet) => total + (examSet.questionCount || 0), 0);
  const publishedCount = examSets.filter((examSet) => examSet.status === "published").length;

  async function addExamSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setIsCreatingExamSet(true);
    try {
      const duration = newDuration ? parseInt(newDuration, 10) : undefined;
      const response = await fetch("/api/exam-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: newSubjectId, title, defaultDurationMinutes: duration }),
      });
      const payload = (await response.json()) as ApiSuccess<ExamSet> | { error?: { message: string } };
      if (!response.ok || !("success" in payload) || !payload.success) {
        throw new Error("error" in payload ? payload.error?.message : "Không thể tạo đề thi.");
      }
      setExamSets((current) => [payload.data, ...current]);
      setNewTitle("");
      setNewDuration("");
      setIsAdding(false);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể tạo đề thi.");
    } finally {
      setIsCreatingExamSet(false);
    }
  }

  function openEditModal(examSet: ExamSet) {
    setIsEditingExamSet(examSet);
    setEditTitle(examSet.title);
    setEditSubjectId(examSet.subjectId);
    setEditDuration(examSet.durationMinutes?.toString() ?? "");
  }

  async function updateExamSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEditingExamSet) return;
    const title = editTitle.trim();
    if (!title) return;

    setIsUpdatingExamSet(true);
    try {
      const duration = editDuration ? parseInt(editDuration, 10) : null;
      const response = await fetch(`/api/exam-sets/${isEditingExamSet._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          subjectId: editSubjectId, 
          title, 
          defaultDurationMinutes: duration
        }),
      });
      const payload = (await response.json()) as ApiSuccess<ExamSet> | { error?: { message: string } };
      if (!response.ok || !("success" in payload) || !payload.success) {
        throw new Error("error" in payload ? payload.error?.message : "Không thể cập nhật đề thi.");
      }
      setExamSets((current) => current.map(set => set._id === isEditingExamSet._id ? payload.data : set));
      setIsEditingExamSet(null);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể cập nhật đề thi.");
    } finally {
      setIsUpdatingExamSet(false);
    }
  }

  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = newSubjectCode.trim().toUpperCase();
    const name = newSubjectName.trim();
    if (!code || !name) return;

    setIsCreatingSubject(true);
    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      const payload = await response.json() as ApiSuccess<Subject> | { success: false; error: { message: string } };
      if (!response.ok || !("success" in payload) || !payload.success) {
        throw new Error("error" in payload ? payload.error?.message : "Không thể tạo môn học.");
      }
      const createdSubject = payload.data;
      setSubjects((current) => [...current, createdSubject].sort((a, b) => a.code.localeCompare(b.code)));
      setNewSubjectId(createdSubject._id);
      setNewSubjectCode("");
      setNewSubjectName("");
      setIsAddingSubject(false);
      setSubjectErrorMessage("");
    } catch (error) {
      setSubjectErrorMessage(error instanceof Error ? error.message : "Không thể tạo môn học.");
    } finally {
      setIsCreatingSubject(false);
    }
  }

  async function removeExamSet(id: string) {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đề thi này không?")) return;
    try {
      const response = await fetch(`/api/exam-sets/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Không thể xóa đề thi.");
      setExamSets((current) => current.map((set) => set._id === id ? { ...set, status: "archived" } : set));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể xóa đề thi.");
    }
  }

  return (
    <SidebarLayout>
      <main className="dashboard-main" id="top">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{LABELS.CONTENT_MANAGEMENT}</p>
            <h1>{LABELS.QUESTION_SETS}</h1>
            <p className="page-description">Create, organize and manage your practice questions.</p>
          </div>
          {errorMessage && <p className="api-error" role="alert">{errorMessage}</p>}
          <button className="add-button" type="button" onClick={() => setIsAdding(true)}>
            <span aria-hidden="true">+</span> {LABELS.NEW_QUESTION_SET}
          </button>
        </section>

        <section className="stats-grid" aria-label="Question set overview">
          <article className="stat-card">
            <div className="stat-icon violet-icon">▱</div>
            <div><p>Tổng số đề thi</p><strong>{examSets.filter(s => s.status !== "archived").length}</strong></div>
          </article>
          <article className="stat-card">
            <div className="stat-icon blue-icon">✓</div>
            <div><p>Đề sẵn sàng</p><strong>{publishedCount}</strong></div>
          </article>
          <article className="stat-card">
            <div className="stat-icon orange-icon">?</div>
            <div><p>Tổng số câu hỏi</p><strong>{totalQuestions}</strong></div>
          </article>
        </section>

        <section className="workspace-card" id="question-sets">
          <div className="workspace-toolbar">
            <div>
              <h2>{LABELS.QUESTION_SETS}</h2>
              <p>{filteredExamSets.length} đề thi</p>
            </div>
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">{LABELS.SEARCH_BY_EXAM_NAME}</span>
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={`${LABELS.SEARCH_BY_EXAM_NAME}...`} />
            </label>
          </div>

          <div className="content-layout">
            <aside className="subject-sidebar" id="subjects">
              <div className="subject-sidebar-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="sidebar-label" style={{ margin: 0 }}>{LABELS.FILTER_BY_SUBJECT}</p>
                <button
                  type="button"
                  className="add-subject-button"
                  onClick={() => setIsAddingSubject(true)}
                  aria-label="Add subject"
                >
                  +
                </button>
              </div>
              <div className="subject-list">
                <button
                  className={`subject-filter ${selectedSubjectId === "ALL" ? "selected" : ""}`}
                  type="button"
                  onClick={() => setSelectedSubjectId("ALL")}
                >
                  <span className={`subject-dot violet`} />
                  <span>{LABELS.ALL_SUBJECTS}</span>
                  <span className="subject-count">{examSets.filter(s => s.status !== "archived").length}</span>
                </button>
                {!isLoadingSubjects && subjects.map((subject) => {
                  const accent = accentFromSubjectCode(subject.code);
                  return (
                    <button
                      className={`subject-filter ${selectedSubjectId === subject._id ? "selected" : ""}`}
                      type="button"
                      key={subject._id}
                      onClick={() => setSelectedSubjectId(subject._id)}
                    >
                      <span className={`subject-dot ${accent}`} />
                      <span>{subject.code}</span>
                      <span className="subject-count">{examSets.filter((examSet) => examSet.subjectId === subject._id && examSet.status !== "archived").length}</span>
                    </button>
                  );
                })}
                {isLoadingSubjects && <p className="sidebar-label" style={{ marginTop: 8 }}>Loading...</p>}
              </div>
            </aside>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>{LABELS.QUESTION_SETS}</th><th>{LABELS.SUBJECTS}</th><th>Thời gian</th><th>{LABELS.NUMBER_OF_QUESTIONS}</th><th>Status</th><th>{LABELS.LAST_UPDATED}</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {!isLoadingExamSets && filteredExamSets.map((examSet) => {
                    const subjectCode = examSet.subject?.code ?? "N/A";
                    const accent = accentFromSubjectCode(subjectCode);
                    const statusLabel = examSet.status === "published" ? LABELS.PUBLISHED : LABELS.DRAFT;
                    return (
                      <tr key={examSet._id}>
                        <td><div className="set-title"><span className={`set-icon ${accent}`}>Q</span><strong>{examSet.title}</strong></div></td>
                        <td><span className={`subject-tag ${accent}`}>{subjectCode}</span></td>
                        <td>{examSet.durationMinutes ? `${examSet.durationMinutes}p` : "—"}</td>
                        <td><span className="question-count">{examSet.questionCount}</span></td>
                        <td><span className={`status ${examSet.status === "published" ? "published" : "draft"}`}><span />{statusLabel}</span></td>
                        <td className="updated-at">{new Date(examSet.updatedAt).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="row-menu" type="button" onClick={() => openEditModal(examSet)} aria-label={`Edit ${examSet.title}`}>Sửa</button>
                            <button className="row-menu" type="button" onClick={() => removeExamSet(examSet._id)} aria-label={`Delete ${examSet.title}`}>Xóa</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {isLoadingExamSets && <p className="empty-state">Đang tải dữ liệu từ MongoDB...</p>}
              {!isLoadingExamSets && filteredExamSets.length === 0 && <p className="empty-state">Không có đề thi nào phù hợp với bộ lọc.</p>}
            </div>
          </div>
        </section>
      </main>

      {isAdding && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIsAdding(false)}>
          <form className="modal-card" onSubmit={addExamSet}>
            <div className="modal-heading"><div><p className="eyebrow">New content</p><h2>{LABELS.CREATE_QUESTION_SET}</h2></div><button type="button" className="close-button" onClick={() => setIsAdding(false)} aria-label="Close">×</button></div>
            
            {subjects.length === 0 && !isLoadingSubjects && (
              <p className="api-error" style={{ marginBottom: 16 }}>
                Bạn cần tạo ít nhất một môn học trước khi tạo đề thi.
              </p>
            )}

            <label>{LABELS.EXAM_NAME}<input autoFocus required value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="e.g. ENW492c Practice Exam" disabled={subjects.length === 0} /></label>
            <label>{LABELS.SUBJECT}
              <select value={newSubjectId} onChange={(event) => setNewSubjectId(event.target.value)} disabled={subjects.length === 0}>
                {subjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.code} — {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label>Thời gian (phút) - Tùy chọn<input type="number" min="1" value={newDuration} onChange={(event) => setNewDuration(event.target.value)} placeholder="e.g. 60" disabled={subjects.length === 0} /></label>
            <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setIsAdding(false)}>{LABELS.CANCEL}</button><button type="submit" className="add-button" disabled={isCreatingExamSet || subjects.length === 0}>{LABELS.CREATE_SET}</button></div>
          </form>
        </div>
      )}

      {isEditingExamSet && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIsEditingExamSet(null)}>
          <form className="modal-card" onSubmit={updateExamSet}>
            <div className="modal-heading"><div><p className="eyebrow">Update content</p><h2>Sửa Đề Thi</h2></div><button type="button" className="close-button" onClick={() => setIsEditingExamSet(null)} aria-label="Close">×</button></div>
            <label>{LABELS.EXAM_NAME}<input autoFocus required value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="e.g. ENW492c Practice Exam" /></label>
            <label>{LABELS.SUBJECT}
              <select value={editSubjectId} onChange={(event) => setEditSubjectId(event.target.value)}>
                {subjects.map((subject) => (
                  <option key={subject._id} value={subject._id}>
                    {subject.code} — {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label>Thời gian (phút) - Tùy chọn<input type="number" min="1" value={editDuration} onChange={(event) => setEditDuration(event.target.value)} placeholder="e.g. 60" /></label>
            <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setIsEditingExamSet(null)}>{LABELS.CANCEL}</button><button type="submit" className="add-button" disabled={isUpdatingExamSet}>Cập nhật</button></div>
          </form>
        </div>
      )}

      {isAddingSubject && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIsAddingSubject(false)}>
          <form className="modal-card" onSubmit={addSubject}>
            <div className="modal-heading"><div><p className="eyebrow">New content</p><h2>Thêm môn học</h2></div><button type="button" className="close-button" onClick={() => setIsAddingSubject(false)} aria-label="Close">×</button></div>
            {subjectErrorMessage && <p className="api-error" role="alert">{subjectErrorMessage}</p>}
            <label>Mã môn học<input autoFocus required value={newSubjectCode} onChange={(event) => setNewSubjectCode(event.target.value)} placeholder="e.g. SWT301" /></label>
            <label>Tên môn học<input required value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} placeholder="e.g. Software Testing" /></label>
            <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setIsAddingSubject(false)}>{LABELS.CANCEL}</button><button type="submit" className="add-button" disabled={isCreatingSubject}>Thêm môn học</button></div>
          </form>
        </div>
      )}
    </SidebarLayout>
  );
}
