import type { Dispatch, SetStateAction } from "react";
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
};

export function ImportConfiguration(props: Props) {
  const toggleExamSet = (id: string) => props.setExamSetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

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
          <legend>Đề thi mục tiêu <small>tùy chọn</small></legend>
          <div className="exam-set-options">
            {props.isLoadingExamSets ? <p className="field-hint">Đang tải danh sách đề thi…</p> : props.examSets.length ? props.examSets.map((item) => (
              <label className="check-option" key={item._id}>
                <input type="checkbox" checked={props.examSetIds.includes(item._id)} disabled={props.isConfirming} onChange={() => toggleExamSet(item._id)} />
                <span>{item.title}</span>
                <small>{item.questionCount} câu hỏi · {item.status}</small>
              </label>
            )) : <p className="field-hint">{props.subjectId ? "Không có đề thi khả dụng. Câu hỏi sẽ được lưu vào ngân hàng dùng chung." : "Vui lòng chọn môn học trước."}</p>}
          </div>
        </fieldset>
        <label>Định dạng<select value={props.format} disabled={props.isConfirming} onChange={(event) => props.setFormat(event.target.value as "json" | "structured_text")}><option value="json">JSON</option><option value="structured_text">Văn bản có cấu trúc</option></select></label>
        <label>Xử lý trùng lặp<select value={props.duplicatePolicy} disabled={props.isConfirming} onChange={(event) => props.setDuplicatePolicy(event.target.value as "reject" | "skip" | "allow")}><option value="reject">Từ chối</option><option value="skip">Bỏ qua</option><option value="allow">Cho phép</option></select></label>
        <label>Trạng thái mặc định<select value={props.defaultStatus} disabled={props.isConfirming} onChange={(event) => props.setDefaultStatus(event.target.value as "draft" | "published")}><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option></select></label>
        <label>Độ khó mặc định<select value={props.defaultDifficulty ?? ""} disabled={props.isConfirming} onChange={(event) => props.setDefaultDifficulty((event.target.value || undefined) as "easy" | "medium" | "hard" | undefined)}><option value="">Chưa đặt</option><option value="easy">Dễ</option><option value="medium">Trung bình</option><option value="hard">Khó</option></select></label>
        <label>Trạng thái dịch mặc định<select value={props.defaultTranslationStatus ?? "not_required"} disabled={props.isConfirming} onChange={(event) => props.setDefaultTranslationStatus(event.target.value as "not_required" | "pending" | "translated" | "reviewed" | "failed")}><option value="not_required">Không yêu cầu</option><option value="pending">Đang chờ</option><option value="translated">Đã dịch</option><option value="reviewed">Đã duyệt</option><option value="failed">Lỗi</option></select></label>
      </div>
    </section>
  );
}
