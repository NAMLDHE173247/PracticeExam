export const jsonSample = `[
  {
    "type": "single_choice",
    "content": { "original": "What does HTTP stand for?", "vi": "HTTP là viết tắt của gì?" },
    "options": [
      { "id": "A", "label": "A", "content": { "original": "HyperText Transfer Protocol" }, "isCorrect": true },
      { "id": "B", "label": "B", "content": { "original": "High Transfer Text Process" }, "isCorrect": false }
    ], "tags": ["web"], "status": "draft"
  },
  {
    "type": "multiple_choice",
    "content": { "original": "Which are web browsers?", "vi": "Đâu là trình duyệt web?" },
    "options": [
      { "id": "A", "label": "A", "content": { "original": "Firefox" }, "isCorrect": true },
      { "id": "B", "label": "B", "content": { "original": "Chrome" }, "isCorrect": true },
      { "id": "C", "label": "C", "content": { "original": "PostgreSQL" }, "isCorrect": false }
    ], "tags": ["web"], "status": "draft"
  },
  {
    "type": "true_false_group",
    "content": { "original": "Mark each statement.", "vi": "Đánh dấu từng nhận định." },
    "statements": [
      { "id": "1", "content": { "original": "HTML is a markup language." }, "answer": true },
      { "id": "2", "content": { "original": "CSS is a database." }, "answer": false }
    ], "tags": ["web"], "status": "draft"
  }
]`;

export const structuredSample = `[QUESTION]
TYPE: single_choice
CONTENT: What does HTTP stand for?
CONTENT_VI: HTTP là viết tắt của gì?
A: HyperText Transfer Protocol
B: High Transfer Text Process
ANSWER: A
[/QUESTION]
[QUESTION]
TYPE: multiple_choice
CONTENT: Which are web browsers?
A: Firefox
B: Chrome
C: PostgreSQL
ANSWER: A,B
[/QUESTION]
[QUESTION]
TYPE: true_false_group
CONTENT: Mark each statement.
1: HTML is a markup language. | TRUE
2: CSS is a database. | FALSE
[/QUESTION]`;
