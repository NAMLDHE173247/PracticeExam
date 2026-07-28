import type { QuestionImportIssue, QuestionImportInput } from "./question-import.types";
import type { ParsedImportItem } from "./import-parser-json";

function parseBoolean(value: string): boolean | undefined { const normalized = value.trim().toUpperCase(); if (["TRUE", "ĐÚNG", "T"].includes(normalized)) return true; if (["FALSE", "SAI", "F"].includes(normalized)) return false; return undefined; }

export function parseStructuredText(content: string): { items: ParsedImportItem[]; rootIssues: QuestionImportIssue[] } {
  const blocks = [...content.matchAll(/\[QUESTION\]([\s\S]*?)\[\/QUESTION\]/gi)];
  const outside = content.replace(/\[QUESTION\][\s\S]*?\[\/QUESTION\]/gi, "").trim();
  const rootIssues: QuestionImportIssue[] = content.includes("[QUESTION]") && blocks.length === 0 ? [{ code: "MISSING_BLOCK_END", message: "Block thiếu [/QUESTION].", severity: "error" }] : outside ? [{ code: "CONTENT_OUTSIDE_BLOCK", message: "Có nội dung nằm ngoài block câu hỏi.", severity: "error" }] : [];
  const items = blocks.map((match, itemIndex) => {
    const fields = new Map<string, string>(); const parseIssues: QuestionImportIssue[] = []; const options: Array<{ id: string; label: string; content: { original: string }; isCorrect: boolean }> = []; const statements: Array<{ id: string; content: { original: string }; answer: boolean }> = [];
    for (const line of match[1].split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      const option = line.match(/^([A-H]):\s*(.+)$/i); const statement = line.match(/^(\d+):\s*(.*?)\s*\|\s*(TRUE|FALSE|ĐÚNG|SAI|T|F)$/i); const field = line.match(/^([A-Z_]+):\s*(.*)$/i);
      if (option) options.push({ id: option[1].toUpperCase(), label: option[1].toUpperCase(), content: { original: option[2].trim() }, isCorrect: false });
      else if (statement) { const answer = parseBoolean(statement[3]); if (answer !== undefined) statements.push({ id: statement[1], content: { original: statement[2].trim() }, answer }); else parseIssues.push({ itemIndex, field: statement[1], code: "INVALID_STATEMENT", message: "Giá trị true/false không hợp lệ.", severity: "error" }); }
      else if (field) { const key = field[1].toUpperCase(); if (!["TYPE", "CONTENT", "CONTENT_VI", "ANSWER", "EXPLANATION", "EXPLANATION_VI", "DIFFICULTY", "TAGS", "STATUS"].includes(key)) parseIssues.push({ itemIndex, field: key, code: "UNSUPPORTED_FIELD", message: `Field ${key} không được hỗ trợ.`, severity: "warning" }); else fields.set(key, field[2].trim()); }
    }
    const type = fields.get("TYPE"); const answerLabels = (fields.get("ANSWER") ?? "").split(/[, ]+/).filter(Boolean).map((value) => value.toUpperCase());
    if (type === "single_choice" || type === "multiple_choice") for (const option of options) option.isCorrect = answerLabels.includes(option.id);
    const question: QuestionImportInput = { type, content: fields.get("CONTENT") ? { original: fields.get("CONTENT")!, ...(fields.get("CONTENT_VI") ? { vi: fields.get("CONTENT_VI")! } : {}) } : undefined, options: type === "true_false_group" ? undefined : options, statements: type === "true_false_group" ? statements : undefined, explanation: fields.get("EXPLANATION") ? { original: fields.get("EXPLANATION")!, ...(fields.get("EXPLANATION_VI") ? { vi: fields.get("EXPLANATION_VI")! } : {}) } : undefined, difficulty: fields.get("DIFFICULTY"), tags: fields.get("TAGS")?.split(",").map((tag) => tag.trim()), status: fields.get("STATUS") as "draft" | "published" | undefined } as QuestionImportInput;
    return { itemIndex, raw: match[1], normalizedQuestion: question, parseIssues };
  });
  return { items, rootIssues };
}
