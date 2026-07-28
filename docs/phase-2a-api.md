# Phase 2A API

Management APIs only. Import, authentication, exam attempts, autosave, submit, grading runtime, history, statistics and frontend redesign are out of scope.

## Endpoints

### Subjects

- `GET /api/subjects?page=1&pageSize=20&search=&isActive=true&sort=name&order=asc`
- `POST /api/subjects` with `{ code, name, description? }`
- `GET|PATCH|DELETE /api/subjects/:id`

Delete is a soft disable. It never deletes related exam sets or questions.

### Exam sets

- `GET /api/exam-sets?page=1&pageSize=20&subjectId=&status=&search=&sort=createdAt&order=desc`
- `POST /api/exam-sets` with `{ subjectId, title, description?, defaultDurationMinutes?, passingScore?, status? }`
- `GET|PATCH|DELETE /api/exam-sets/:id`
- `GET /api/exam-sets/:id/questions`

`questionCount` is server-owned. Delete archives the set and preserves question relations.

### Questions

- `GET /api/questions` supports subject, exam set, type, status, difficulty, tag, search, translation status, sort and order filters.
- `POST /api/questions` accepts a Phase 1 question plus optional `allowDuplicate`.
- `GET|PATCH|DELETE /api/questions/:id`
- `POST /api/exam-sets/:id/questions` with `{ mode: "attach", questionId }` or `{ mode: "create", question }`.
- `DELETE /api/exam-sets/:id/questions/:questionId`

Questions are archived rather than hard-deleted. Relations require existing, active, same-subject, non-archived exam sets. Attach and remove are idempotent and update counts only when the relation changes.

## Error codes

`VALIDATION_ERROR`, `INVALID_OBJECT_ID`, `NOT_FOUND`, `DUPLICATE_RESOURCE`, `RESOURCE_IN_USE`, `INVALID_RELATION`, `CONFLICT` and `INTERNAL_ERROR`. Stack traces are never returned to clients.

## Transactions and repair

The shared `runInTransaction` helper uses a MongoDB session and always ends it. A local standalone MongoDB does not support transactions; configure a replica set or MongoDB Atlas before using multi-document transactional flows. Count audit is read-only; repair is manual and must be reviewed before execution.
