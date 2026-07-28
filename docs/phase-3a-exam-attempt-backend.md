# Phase 3A — Exam Attempt Backend

Phase 3A cung cấp backend cho lượt làm bài, chưa có màn hình thi, trang kết quả, authentication hoàn chỉnh, wrong-answer mode, thống kê hoặc Phase 3B.

## API contract

- `POST /api/exam-attempts`: nhận `userId` và mode `exam_set` hoặc `mixed`, kiểm tra user active, subject active, exam set published và tạo snapshot.
- `GET /api/exam-attempts/[id]?userId=...`: lấy attempt của đúng user. Thời gian còn lại tính từ `deadlineAt` và server time; GET không tự sửa database.
- `PATCH /api/exam-attempts/[id]/answers`: nhận `userId`, `questionId`, selected options, statement answers hoặc flag. Autosave chỉ hoạt động khi attempt còn `in_progress` và chưa quá hạn.
- `POST /api/exam-attempts/[id]/submit`: chỉ nhận `userId`; server claim attempt, chấm bằng answer-key snapshot và trả kết quả.

`userId` là contract tạm thời trước khi tích hợp authentication. Mọi endpoint đều kiểm tra ownership; không hard-code user hoặc attempt ID.

## Snapshot và answer key

`questionSnapshots` chỉ chứa nội dung hiển thị, không chứa `isCorrect`, `answer` hoặc explanation. `answerKeySnapshots` giữ đáp án server-side trong attempt và không được serializer trả về. Vì vậy chỉnh sửa/archive question sau khi bắt đầu không thay đổi đề hoặc kết quả.

Shuffle câu hỏi và options chỉ chạy lúc tạo attempt, thứ tự đã chọn được lưu trong snapshot. Mixed mode loại câu trùng theo question ID trước khi chọn.

## Deadline và autosave

Database lưu `startedAt`, `deadlineAt` và `durationSeconds`, không lưu `remainingSeconds` làm nguồn sự thật. GET trả `secondsRemaining = max(0, deadlineAt - serverNow)`. Autosave sau deadline trả `ATTEMPT_TIME_EXPIRED`; GET không tự expire attempt.

## Submit và idempotency

Submit claim nguyên tử `in_progress -> submitting`. Chỉ request claim thành công mới chấm. Request sau khi `submitted` hoặc `expired` nhận kết quả cũ; request khi đang `submitting` nhận conflict. Grading user answers và cập nhật attempt dùng cùng MongoDB transaction. Nếu transaction lỗi, attempt được đưa khỏi `submitting`; MongoDB local cần replica set hoặc MongoDB Atlas để transaction hoạt động.

## Scoring

Mỗi câu có max score 1. Single choice dùng strict; multiple choice dùng `settings.scoringMode`; true/false group dùng strict hoặc partial. Tổng điểm chuẩn hóa về thang 10 và làm tròn một chữ số bằng helper duy nhất. Counts gồm đúng, sai, bỏ trống và partially correct, tổng bằng số câu.

## Error codes

Các lỗi chính: `USER_NOT_FOUND`, `ATTEMPT_NOT_FOUND`, `ATTEMPT_FORBIDDEN`, `ATTEMPT_NOT_IN_PROGRESS`, `ATTEMPT_ALREADY_SUBMITTING`, `ATTEMPT_TIME_EXPIRED`, `ATTEMPT_NO_QUESTIONS`, `INVALID_ANSWER`, `QUESTION_NOT_IN_ATTEMPT`, `INSUFFICIENT_QUESTIONS`, `EXAM_SET_NOT_PUBLISHED`, `SUBJECT_INACTIVE`, `TRANSACTION_REQUIRED`.

## Audit và giới hạn

`npm run db:audit:attempts` chỉ đọc dữ liệu và báo attempt submitted thiếu score, count lệch, answer key lệch, attempt quá hạn còn in progress, answer mồ côi/trùng hoặc thiếu grading. Phase 3A không có repair script, không migrate/xóa dữ liệu cũ và chưa triển khai authentication, frontend, PDF/DOCX/AI hay Phase 3B.
