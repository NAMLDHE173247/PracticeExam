import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { serializeValue } from "../src/lib/api/serialize";
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }));
import { createExamSetSchema } from "../src/modules/exam-sets/exam-set.api.schema";
import { createSubjectSchema } from "../src/modules/subjects/subject.api.schema";
import { SubjectService } from "../src/modules/subjects/subject.service";
import type { SubjectRepository } from "../src/modules/subjects/subject.repository";

describe("Phase 2A backend primitives", () => {
  it("normalizes subject create input and defaults active state in the service", async () => {
    const created = { _id: new ObjectId(), code: "ENW492C", name: "English", isActive: true, createdAt: new Date(), updatedAt: new Date() };
    const repository = { findByCode: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ insertedId: created._id }), findById: vi.fn().mockResolvedValue(created) } as unknown as SubjectRepository;
    const service = new SubjectService(repository, Promise.resolve({ countDocuments: vi.fn().mockResolvedValue(0) } as never));
    await service.create({ code: " enw492c ", name: " English " });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ code: "ENW492C", name: "English", isActive: true }));
    expect(createSubjectSchema.safeParse({ code: "A", name: "B", isActive: false }).success).toBe(false);
  });

  it("validates exam-set duration and score boundaries", () => {
    const subjectId = new ObjectId().toHexString();
    expect(createExamSetSchema.safeParse({ subjectId, title: "Set", defaultDurationMinutes: 60, passingScore: 7 }).success).toBe(true);
    expect(createExamSetSchema.safeParse({ subjectId, title: "Set", defaultDurationMinutes: 601 }).success).toBe(false);
    expect(createExamSetSchema.safeParse({ subjectId, title: "Set", passingScore: 11 }).success).toBe(false);
  });

  it("serializes ObjectId and Date without exposing MongoDB values", () => {
    const id = new ObjectId(); const date = new Date("2026-01-01T00:00:00.000Z");
    expect(serializeValue({ id, date })).toEqual({ id: id.toHexString(), date: date.toISOString() });
  });
});
