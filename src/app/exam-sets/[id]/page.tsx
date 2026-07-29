"use client";

import { useEffect, useState, FormEvent, use, useRef } from "react";
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

type ImportValidationResult = {
  jobId: string;
  confirmToken: string;
  summary: {
    validItems: number;
    invalidItems: number;
    totalItems: number;
    canConfirm: boolean;
  };
  items: Array<{
    itemIndex: number;
    status: string;
    issues: Array<{ message: string }>;
  }>;
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

  // Import JSON states
  const [isImporting, setIsImporting] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [importResult, setImportResult] = useState<ImportValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [examSetId]);

  async function loadData() {
    setIsLoading(true);
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

  async function reloadExamSet() {
    try {
      const res = await fetch(`/api/exam-sets/${examSetId}`);
      if (res.ok) {
        const payload = await res.json() as ApiSuccess<ExamSet>;
        setExamSet(payload.data);
      }
    } catch (err) {}
  }

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
      await reloadExamSet();
    } catch (error) {
      alert("Xóa thất bại");
    }
  }

  async function handleSaveQuestion(e: FormEvent) {
    e.preventDefault();
    if (!examSet) return;
    if (qOptions.length < 2) {
      alert("Cần ít nhất 2 đáp án.");
      return;
    }
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
        await reloadExamSet();
      }
      setIsEditing(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Có lỗi xảy ra");
    } finally {
      setIsSaving(false);
    }
  }

  // Handle JSON Import
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setImportJson(ev.target.result as string);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function validateImport() {
    if (!examSet) return;
    if (!importJson.trim()) {
      alert("Vui lòng nhập JSON.");
      return;
    }

    setIsValidating(true);
    setImportResult(null);

    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error("JSON phải là một mảng (array).");
      
      const adapted = parsed.map(item => {
        if (!item.question || !Array.isArray(item.options) || typeof item.correctAnswer !== 'number') {
          throw new Error("Dữ liệu không đúng định dạng yêu cầu (thiếu question, options hoặc correctAnswer).");
        }
        return {
          type: "single_choice",
          content: { original: item.question },
          explanation: item.explanation ? { original: item.explanation } : undefined,
          options: item.options.map((optStr: string, index: number) => ({
            label: String.fromCharCode(65 + index),
            content: { original: optStr },
            isCorrect: index === item.correctAnswer
          }))
        };
      });

      const res = await fetch("/api/questions/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: examSet.subjectId,
          targetExamSetIds: [examSetId],
          inputFormat: "json",
          content: JSON.stringify(adapted),
          options: { duplicatePolicy: "allow", defaultStatus: "published" }
        })
      });

      const payload = await res.json() as ApiSuccess<ImportValidationResult> | { error?: { message: string } };
      if (!res.ok || !("success" in payload)) {
        throw new Error("error" in payload ? payload.error?.message : "Lỗi kiểm tra dữ liệu.");
      }
      setImportResult(payload.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Có lỗi xảy ra khi kiểm tra JSON.");
    } finally {
      setIsValidating(false);
    }
  }

  async function confirmImport() {
    if (!importResult) return;
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/questions/import/${importResult.jobId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmToken: importResult.confirmToken })
      });
      if (!res.ok) throw new Error("Nhập dữ liệu thất bại.");
      
      alert(`Đã nhập thành công ${importResult.summary.validItems} câu hỏi!`);
      setIsImporting(false);
      setImportJson("");
      setImportResult(null);
      await loadData(); // Reload everything
    } catch (err) {
      alert(err instanceof Error ? err.message : "Có lỗi xảy ra khi xác nhận nhập.");
    } finally {
      setIsConfirming(false);
    }
  }

  async function cancelImport() {
    if (importResult?.jobId) {
      try {
        await fetch(`/api/questions/import/${importResult.jobId}/cancel`, { method: "POST" });
      } catch (e) {}
    }
    setIsImporting(false);
    setImportJson("");
    setImportResult(null);
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="row-menu" style={{ padding: '8px 16px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setIsImporting(true)}>Nhập câu hỏi JSON</button>
            <button className="add-button" onClick={openCreateModal}>+ Thêm câu hỏi</button>
          </div>
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

      {/* Editor Modal */}
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
                  <button 
                    type="button" 
                    onClick={() => {
                      if (qOptions.length <= 2) {
                        alert("Một câu hỏi phải có ít nhất 2 đáp án.");
                        return;
                      }
                      setQOptions(qOptions.filter((_, idx) => idx !== i));
                    }} 
                    style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'red' }}
                  >
                    ×
                  </button>
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

      {/* Import JSON Modal */}
      {isImporting && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" style={{ width: '700px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Hàng loạt</p>
                <h2>Nhập câu hỏi JSON</h2>
              </div>
              <button type="button" className="close-button" onClick={cancelImport}>×</button>
            </div>

            {!importResult ? (
              <>
                <p style={{ marginBottom: '12px', fontSize: '0.9rem' }}>
                  Dán nội dung JSON vào ô dưới hoặc <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: 'var(--blue-600)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>chọn file .json từ máy</button>.
                  <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                </p>
                <textarea
                  rows={10}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder={`[\n  {\n    "question": "Nội dung",\n    "options": ["A", "B", "C", "D"],\n    "correctAnswer": 1,\n    "explanation": "..."\n  }\n]`}
                  style={{ width: '100%', fontFamily: 'monospace', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '16px' }}
                />
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={cancelImport}>{LABELS.CANCEL}</button>
                  <button type="button" className="add-button" onClick={validateImport} disabled={isValidating}>Kiểm tra dữ liệu</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--surface-color)', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 12px 0' }}>Kết quả kiểm tra</h3>
                  <p>Hợp lệ: <strong>{importResult.summary.validItems}</strong> / {importResult.summary.totalItems}</p>
                  <p style={{ color: 'red' }}>Không hợp lệ: <strong>{importResult.summary.invalidItems}</strong></p>
                </div>
                
                {importResult.items.some(item => item.status === "invalid") && (
                  <div style={{ marginBottom: '16px' }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Các câu hỏi lỗi:</strong>
                    <ul style={{ paddingLeft: '20px', color: 'red', fontSize: '0.9rem' }}>
                      {importResult.items.filter(item => item.status === "invalid").map((item) => (
                        <li key={item.itemIndex}>
                          Câu {item.itemIndex + 1}: {item.issues.map(i => i.message).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setImportResult(null)}>Sửa lại JSON</button>
                  <button type="button" className="add-button" onClick={confirmImport} disabled={isConfirming || !importResult.summary.canConfirm}>
                    Xác nhận nhập ({importResult.summary.validItems} câu)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
