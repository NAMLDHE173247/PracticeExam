import type { ImportFormat } from "@/lib/api/question-import-client";

type Props = {
  format: ImportFormat;
  content: string;
  utf8Bytes: number;
  overLimit: boolean;
  isConfirming: boolean;
  isValidating: boolean;
  copyMessage: string;
  setFormat: (value: ImportFormat) => void;
  setContent: (value: string) => void;
  validate: () => void;
  copySample: (value: string) => void;
  insertSample: () => void;
  clearContent: () => void;
  jsonSample: string;
  structuredSample: string;
};

export function ImportEditor(props: Props) {
  const sample = props.format === "json" ? props.jsonSample : props.structuredSample;
  const formatName = props.format === "json" ? "JSON" : "structured text";

  return (
    <section className="import-editor-card">
      <div className="import-section-heading">
        <div><p className="eyebrow">Bước 2</p><h2>Dữ liệu đầu vào</h2></div>
        <div className="editor-actions">
          <button type="button" className="text-button" onClick={props.insertSample}>Chèn mẫu {formatName}</button>
          <button type="button" className="text-button" onClick={() => void props.copySample(sample)}>Sao chép mẫu</button>
          <button type="button" className="text-button" onClick={props.clearContent}>Xóa trắng</button>
          <span className="copy-result" aria-live="polite">{props.copyMessage}</span>
        </div>
      </div>
      <div className="editor-layout">
        <div>
          <textarea
            aria-label="Import content"
            value={props.content}
            disabled={props.isConfirming}
            onChange={(event) => props.setContent(event.target.value)}
            placeholder={props.format === "json" ? "Dán mảng JSON hoặc { questions: [] } vào đây..." : "Dán các khối [QUESTION] vào đây..."}
          />
          <div className={`editor-meta ${props.overLimit ? "over-limit" : ""}`}>
            <span>{props.utf8Bytes.toLocaleString()} bytes UTF-8 · {props.content.length.toLocaleString()} ký tự</span>
            <span>Tối đa 5 MB</span>
          </div>
          {props.overLimit && <p className="field-error" role="alert">Nội dung vượt quá giới hạn 5 MB. Vui lòng giảm bớt trước khi xác thực.</p>}
        </div>
        <aside className="format-help">
          <h3>Định dạng {formatName}</h3>
          <pre>{sample}</pre>
          {props.format === "structured_text" && <p>Sử dụng 2-8 lựa chọn. Câu hỏi nhiều lựa chọn cần ít nhất 2 đáp án đúng, nhưng không phải tất cả. Đúng/sai chấp nhận TRUE, FALSE, ĐÚNG, SAI, T hoặc F.</p>}
        </aside>
      </div>
      <div className="import-actions">
        <button className="add-button" type="button" disabled={props.isValidating || props.isConfirming || props.overLimit || !props.content.trim()} onClick={props.validate}>
          {props.isValidating ? "Đang xác thực..." : "Xác thực và xem trước"}
        </button>
      </div>
    </section>
  );
}
