"use client";

import { useEffect, useState, FormEvent, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { LABELS } from "@/lib/constants/labels";

type ExamSet = {
  _id: string;
  subjectId: string;
  title: string;
  durationMinutes?: number;
  questionCount: number;
  status: string;
};

type Option = {
  id: string;
  label: string;
  content: { original: string };
  isCorrect: boolean;
};

type Question = {
  _id: string;
  subjectId: string;
  examSetIds: string[];
  type: string;
  content: { original: string };
  explanation?: { original: string };
  options?: Option[];
  status: string;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

export default function ExamSetQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const examSetId = resolvedParams.id;
  const router = useRouter();

  const [examSet, setExamSet] = useState<ExamSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  
  const [qContent, setQContent] = useState("");
  const [qExplanation, setQExplanation] = useState("");
  const [qOptions, setQOptions] = useState<Option[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [examSetRes, questionsRes] = await Promise.all([
          fetch(`/api/exam-sets/${examSetId}`),
          fetch(`/api/exam-sets/${examSetId}/questions?page=1&pageSize=100`)
        ]);

        const examSetPayload = await examSetRes.json() as ApiSuccess<ExamSet> | { error?: { message: string } };
        if (!examSetRes.ok || !("success" in examSetPayload)) {
          throw new Error("Không thể tải thông tin đề thi.");
        }
        setExamSet(examSetPayload.data);

        const questionsPayload = await questionsRes.json() as ApiSuccess<Question[]> | { error?: { message: string } };
        if (!questionsRes.ok || !("success" in questionsPayload)) {
          throw new Error("Không thể tải danh sách câu hỏi.");
        }
        setQuestions(questionsPayload.data.filter(q => q.status !== "archived"));
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Có lỗi xảy ra.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, [examSetId]);

  function openCreateModal() {
    setEditingQuestion(null);
    setQContent("");
    setQExplanation("");
    setQOptions([
      { id: "opt-1", label: "A", content: { original: "" }, isCorrect: true },
      { id: "opt-2", label: "B", content: { original: "" }, isCorrect: false },
      { id: "opt-3", label: "C", content: { original: "" }, isCorrect: false },
      { id: "opt-4", label: "D", content: { original: "" }, isCorrect: false },
    ]);
    setIsEditing(true);
  }

  function openEditModal(q: Question) {
    setEditingQuestion(q);
    setQContent(q.content.original);
    setQExplanation(q.explanation?.original || "");
    setQOptions(q.options ? JSON.parse(JSON.stringify(q.options)) : []);
    setIsEditing(true);
  }

  async function removeQuestion(id: string) {
    if (!window.confirm("Bạn có chắc chắn muốn xóa câu hỏi này không?")) return;
    try {
      const response = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Không thể xóa câu hỏi.");
      setQuestions(prev => prev.filter(q => q._id !== id));
      if (examSet) setExamSet({ ...examSet, questionCount: examSet.questionCount - 1 });
    } catch (error) {
      alert("Xóa thất bại");
    }
  }

  async function handleSaveQuestion(e: FormEvent) {
    e.preventDefault();
    if (!examSet) return;
    if (qOptions.filter(o => o.isCorrect).length !== 1) {
      alert("Vui lòng chọn ĐÚNG MỘT đáp án đúng.");
      return;
    }
    if (qOptions.some(o => !o.content.original.trim())) {
      alert("Nội dung các đáp án không được để trống.");
      return;
    }

    setIsSaving(true);
    try {
      const bodyPayload = {
        subjectId: examSet.subjectId,
        type: "single_choice",
        content: { original: qContent.trim() },
        explanation: qExplanation.trim() ? { original: qExplanation.trim() } : undefined,
        options: qOptions.map(o => ({
          id: o.id,
          label: o.label,
          content: { original: o.content.original.trim() },
          isCorrect: o.isCorrect
        })),
        status: "published"
      };

      if (editingQuestion) {
        const res = await fetch(`/api/questions/${editingQuestion._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload)
        });
        const payload = await res.json() as ApiSuccess<Question>;
        if (!res.ok || !("success" in payload)) throw new Error("Cập nhật thất bại");
        setQuestions(prev => prev.map(q => q._id === editingQuestion._id ? payload.data : q));
      } else {
        const res = await fetch(`/api/exam-sets/${examSetId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "create", question: bodyPayload })
        });
        const payload = await res.json() as ApiSuccess<Question>;
        if (!res.ok || !("success" in payload)) throw new Error("Tạo mới thất bại");
        setQuestions(prev => [payload.data, ...prev]);
        setExamSet({ ...examSet, questionCount: examSet.questionCount + 1 });
      }
      setIsEditing(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Có lỗi xảy ra");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SidebarLayout>
      <main className="dashboard-main" id="top">
        <section className="page-heading">
          <div>
            <p className="eyebrow cursor-pointer" onClick={() => router.push("/")}>← Quay lại trang chủ</p>
            <h1>{examSet?.title || "Quản lý câu hỏi"}</h1>
            <p className="page-description">Quản lý các câu hỏi thuộc đề thi này.</p>
          </div>
          <button className="add-button" onClick={openCreateModal}>+ Thêm câu hỏi</button>
        </section>

        {errorMessage && <p className="api-error" style={{ margin: "20px 48px" }}>{errorMessage}</p>}

        <section className="workspace-card" style={{ margin: "0 48px" }}>
          <div className="workspace-toolbar">
            <div>
              <h2>Danh sách câu hỏi</h2>
              <p>{questions.length} câu hỏi</p>
            </div>
          </div>

          <div className="table-wrap" style={{ padding: "0 24px 24px" }}>
            {isLoading ? (
              <p>Đang tải...</p>
            ) : questions.length === 0 ? (
              <p className="empty-state">Chưa có câu hỏi nào. Bấm "+ Thêm câu hỏi" để bắt đầu.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {questions.map((q, index) => (
                  <div key={q._id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>Câu {index + 1}: {q.content.original}</h3>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="row-menu" onClick={() => openEditModal(q)}>Sửa</button>
                        <button className="row-menu" onClick={() => removeQuestion(q._id)}>Xóa</button>
                      </div>
                    </div>
                    {q.options && (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {q.options.map(opt => (
                          <li key={opt.id} style={{ color: opt.isCorrect ? 'var(--blue-600)' : 'inherit', fontWeight: opt.isCorrect ? 600 : 400, marginBottom: '4px' }}>
                            {opt.label}. {opt.content.original} {opt.isCorrect && "✓"}
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.explanation?.original && (
                      <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'var(--surface-color)', borderRadius: '4px', fontSize: '0.9rem' }}>
                        <strong>Giải thích:</strong> {q.explanation.original}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {isEditing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setIsEditing(false)}>
          <form className="modal-card" onSubmit={handleSaveQuestion} style={{ width: '600px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{editingQuestion ? "Cập nhật" : "Tạo mới"}</p>
                <h2>{editingQuestion ? "Sửa câu hỏi" : "Thêm câu hỏi"}</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setIsEditing(false)}>×</button>
            </div>

            <label>
              Nội dung câu hỏi
              <textarea 
                required 
                rows={3}
                value={qContent} 
                onChange={(e) => setQContent(e.target.value)} 
                placeholder="Ví dụ: Ai là người tìm ra châu Mỹ?" 
              />
            </label>

            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
              <strong style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Các đáp án (Đánh dấu ô Checkbox cho đáp án ĐÚNG)</strong>
              {qOptions.map((opt, i) => (
                <div key={opt.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input 
                    type="checkbox" 
                    checked={opt.isCorrect} 
                    onChange={(e) => {
                      const newOpts = [...qOptions];
                      newOpts.forEach(o => o.isCorrect = false);
                      newOpts[i].isCorrect = e.target.checked;
                      setQOptions(newOpts);
                    }} 
                    style={{ width: '20px', height: '20px' }}
                  />
                  <input 
                    style={{ width: '40px', padding: '8px', textAlign: 'center' }} 
                    value={opt.label} 
                    onChange={(e) => {
                      const newOpts = [...qOptions];
                      newOpts[i].label = e.target.value.toUpperCase();
                      setQOptions(newOpts);
                    }} 
                  />
                  <input 
                    style={{ flex: 1 }} 
                    placeholder={`Nội dung đáp án`} 
                    value={opt.content.original} 
                    onChange={(e) => {
                      const newOpts = [...qOptions];
                      newOpts[i].content.original = e.target.value;
                      setQOptions(newOpts);
                    }} 
                    required 
                  />
                  <button type="button" onClick={() => setQOptions(qOptions.filter((_, idx) => idx !== i))} style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'red' }}>×</button>
                </div>
              ))}
              <button 
                type="button" 
                className="row-menu" 
                onClick={() => setQOptions([...qOptions, { id: `opt-${Date.now()}`, label: String.fromCharCode(65 + qOptions.length), content: { original: "" }, isCorrect: false }])}
              >
                + Thêm đáp án
              </button>
            </div>

            <label>
              Giải thích (Tùy chọn)
              <textarea 
                rows={2}
                value={qExplanation} 
                onChange={(e) => setQExplanation(e.target.value)} 
                placeholder="Giải thích tại sao đáp án lại đúng..." 
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="cancel-button" onClick={() => setIsEditing(false)}>{LABELS.CANCEL}</button>
              <button type="submit" className="add-button" disabled={isSaving}>Lưu câu hỏi</button>
            </div>
          </form>
        </div>
      )}
    </SidebarLayout>
  );
}
