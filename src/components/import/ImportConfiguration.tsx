import { useState, type Dispatch, type SetStateAction, type FormEvent } from "react";
import type { ExamSet, Subject } from "@/lib/api/question-import-client";

type Props = {
  subjects: Subject[];
  examSets: ExamSet[];
  subjectId: string;
  examSetIds: string[];
  format: "json" | "structured_text";
  duplicatePolicy: "reject" | "skip" | "allow";
  defaultStatus: "draft" | "published";
  defaultDifficulty?: "easy" | "medium" | "hard";
  defaultTranslationStatus?: "not_required" | "pending" | "translated" | "reviewed" | "failed";
  isLoadingSubjects: boolean;
  isLoadingExamSets: boolean;
  isConfirming: boolean;
  setSubject: (value: string) => void;
  setExamSetIds: Dispatch<SetStateAction<string[]>>;
  setFormat: (value: "json" | "structured_text") => void;
  setDuplicatePolicy: (value: "reject" | "skip" | "allow") => void;
  setDefaultStatus: (value: "draft" | "published") => void;
  setDefaultDifficulty: (value: "easy" | "medium" | "hard" | undefined) => void;
  setDefaultTranslationStatus: (value: "not_required" | "pending" | "translated" | "reviewed" | "failed") => void;
  setExamSets: Dispatch<SetStateAction<ExamSet[]>>;
};

export function ImportConfiguration(props: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [isCreatingExamSet, setIsCreatingExamSet] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [isEditingExamSet, setIsEditingExamSet] = useState<ExamSet | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [isUpdatingExamSet, setIsUpdatingExamSet] = useState(false);

  const toggleExamSet = (id: string) => props.setExamSetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  async function addExamSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || !props.subjectId) return;

    setIsCreatingExamSet(true);
    try {
      const duration = newDuration ? parseInt(newDuration, 10) : undefined;
      const response = await fetch("/api/exam-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: props.subjectId, title, defaultDurationMinutes: duration }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "Không thể tạo đề thi.");
      }
      props.setExamSets((current) => [payload.data, ...current]);
      props.setExamSetIds((current) => [...current, payload.data._id]);
      setNewTitle("");
      setNewDuration("");
      setIsAdding(false);
      setErrorMsg("");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Không thể tạo đề thi.");
    } finally {
      setIsCreatingExamSet(false);
    }
  }

  function openEditModal(examSet: ExamSet) {
    setIsEditingExamSet(examSet);
    setEditTitle(examSet.title);
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
          subjectId: props.subjectId, 
          title, 
          defaultDurationMinutes: duration
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "Không thể cập nhật đề thi.");
      }
      props.setExamSets((current) => current.map(set => set._id === isEditingExamSet._id ? payload.data : set));
      setIsEditingExamSet(null);
      setErrorMsg("");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Không thể cập nhật đề thi.");
    } finally {
      setIsUpdatingExamSet(false);
    }
  }

  return (
    <section className="import-config-card">
      <div className="import-section-heading">
        <div><p className="eyebrow">Bước 1</p><h2>Cấu hình tải lên</h2></div>
        <span className="import-status" aria-live="polite">Chưa xác thực</span>
      </div>
      <div className="import-form-grid">
        <label>
          Môn học
          <select value={props.subjectId} disabled={props.isLoadingSubjects || props.isConfirming} onChange={(event) => props.setSubject(event.target.value)}>
            <option value="">Chọn môn học</option>
            {props.subjects.map((item) => <option key={item._id} value={item._id}>{item.code} — {item.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <span>Đề thi mục tiêu <small>tùy chọn</small></span>
            {props.subjectId && (
              <button type="button" onClick={() => setIsAdding(true)} style={{ background: "none", border: "none", color: "var(--blue-600)", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>
                + Thêm đề thi mới
              </button>
            )}
          </legend>
          <div className="exam-set-options">
            {props.isLoadingExamSets ? <p className="field-hint">Đang tải danh sách đề thi…</p> : props.examSets.length ? props.examSets.map((item) => (
              <div key={item._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderBottom: "1px solid var(--gray-200)", paddingBottom: "0.5rem" }}>
                <label className="check-option" style={{ border: "none", padding: 0, margin: 0, flex: 1, backgroundColor: "transparent" }}>
                  <input type="checkbox" checked={props.examSetIds.includes(item._id)} disabled={props.isConfirming} onChange={() => toggleExamSet(item._id)} />
                  <span>{item.title}</span>
                  <small>{item.questionCount} câu hỏi · {item.status}</small>
                </label>
                <button type="button" onClick={() => openEditModal(item)} style={{ background: "none", border: "none", color: "var(--gray-500)", cursor: "pointer", fontSize: "0.875rem", textDecoration: "underline", marginLeft: "1rem" }}>
                  Sửa
                </button>
              </div>
            )) : <p className="field-hint">{props.subjectId ? "Không có đề thi khả dụng. Câu hỏi sẽ được lưu vào ngân hàng dùng chung." : "Vui lòng chọn môn học trước."}</p>}
          </div>
        </fieldset>
        <label>Định dạng<select value={props.format} disabled={props.isConfirming} onChange={(event) => props.setFormat(event.target.value as "json" | "structured_text")}><option value="json">JSON</option><option value="structured_text">Văn bản có cấu trúc</option></select></label>
        <label>Xử lý trùng lặp<select value={props.duplicatePolicy} disabled={props.isConfirming} onChange={(event) => props.setDuplicatePolicy(event.target.value as "reject" | "skip" | "allow")}><option value="reject">Từ chối</option><option value="skip">Bỏ qua</option><option value="allow">Cho phép</option></select></label>
        <label>Trạng thái mặc định<select value={props.defaultStatus} disabled={props.isConfirming} onChange={(event) => props.setDefaultStatus(event.target.value as "draft" | "published")}><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option></select></label>
        <label>Độ khó mặc định<select value={props.defaultDifficulty ?? ""} disabled={props.isConfirming} onChange={(event) => props.setDefaultDifficulty((event.target.value || undefined) as "easy" | "medium" | "hard" | undefined)}><option value="">Chưa đặt</option><option value="easy">Dễ</option><option value="medium">Trung bình</option><option value="hard">Khó</option></select></label>
        <label>Trạng thái dịch mặc định<select value={props.defaultTranslationStatus ?? "not_required"} disabled={props.isConfirming} onChange={(event) => props.setDefaultTranslationStatus(event.target.value as "not_required" | "pending" | "translated" | "reviewed" | "failed")}><option value="not_required">Không yêu cầu</option><option value="pending">Đang chờ</option><option value="translated">Đã dịch</option><option value="reviewed">Đã duyệt</option><option value="failed">Lỗi</option></select></label>
      </div>

      {isAdding && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIsAdding(false)}>
          <form className="modal-card" onSubmit={addExamSet}>
            <div className="modal-heading"><div><p className="eyebrow">Thêm mới</p><h2>Tạo đề thi</h2></div><button type="button" className="close-button" onClick={() => setIsAdding(false)} aria-label="Close">×</button></div>
            {errorMsg && <p className="api-error" role="alert">{errorMsg}</p>}
            <label>Tên đề thi<input autoFocus required value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="e.g. SMK101 Practice" /></label>
            <label>Thời gian (phút) - Tùy chọn<input type="number" min="1" value={newDuration} onChange={(event) => setNewDuration(event.target.value)} placeholder="e.g. 60" /></label>
            <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setIsAdding(false)}>Hủy</button><button type="submit" className="add-button" disabled={isCreatingExamSet}>Tạo đề</button></div>
          </form>
        </div>
      )}

      {isEditingExamSet && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setIsEditingExamSet(null)}>
          <form className="modal-card" onSubmit={updateExamSet}>
            <div className="modal-heading"><div><p className="eyebrow">Cập nhật</p><h2>Sửa Đề Thi</h2></div><button type="button" className="close-button" onClick={() => setIsEditingExamSet(null)} aria-label="Close">×</button></div>
            {errorMsg && <p className="api-error" role="alert">{errorMsg}</p>}
            <label>Tên đề thi<input autoFocus required value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="e.g. SMK101 Practice" /></label>
            <label>Thời gian (phút) - Tùy chọn<input type="number" min="1" value={editDuration} onChange={(event) => setEditDuration(event.target.value)} placeholder="e.g. 60" /></label>
            <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setIsEditingExamSet(null)}>Hủy</button><button type="submit" className="add-button" disabled={isUpdatingExamSet}>Cập nhật</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
