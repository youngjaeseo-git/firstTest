import { z } from "zod";
import { MEMORY_TYPES } from "@/lib/schemas/equipment";

/**
 * Shared zod schemas for the evaluation (memory eval) domain.
 *
 * These mirror the Prisma enums so invalid enum strings or malformed
 * dates/numbers are rejected with a 400 instead of reaching Prisma and
 * throwing an uncaught 500.
 */

export const EVAL_TYPES = ["FIELD", "ACCELERATED"] as const;
export const EVAL_PROJECT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
export const EVAL_PHASE_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "PASSED",
  "FAILED",
  "SKIPPED",
] as const;
export const EVAL_TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
export const EVAL_TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const EVAL_TEST_RESULTS = ["PASS", "FAIL", "WARNING", "RUNNING", "PENDING"] as const;

// ── Project (PATCH /api/evaluations/[id]) ──
export const UpdateProjectSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  evalType: z.enum(EVAL_TYPES).optional(),
  status: z.enum(EVAL_PROJECT_STATUSES).optional(),
  memoryType: z.enum(MEMORY_TYPES).nullable().optional(),
  manufacturer: z.string().trim().max(100).nullable().optional(),
  partNumber: z.string().trim().max(200).nullable().optional(),
  capacityGb: z.coerce.number().min(0).max(65536).nullable().optional(),
  speedMhz: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  formFactor: z.string().trim().max(50).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  assigneeId: z.string().trim().max(50).nullable().optional(),
});

// ── Step Config (stored in EvalPhase.config as JSON) ──
export const StepConfigSchema = z
  .object({
    testMode: z.string().max(100).optional(),
    pagePolicy: z.string().max(100).optional(),
    rasMode: z.string().max(100).optional(),
    keepTm: z.boolean().optional(),
    reboot: z.boolean().optional(),
    workloads: z.array(z.string().max(100)).max(20).optional(),
    label: z.string().max(200).optional(),
    testTime: z.string().max(50).optional(),
    loopCount: z.number().int().min(0).max(10000).optional(),
  })
  .nullable()
  .optional();

// ── Phase ──
export const CreatePhaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  config: StepConfigSchema,
});
export const UpdatePhaseSchema = z.object({
  phaseId: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(EVAL_PHASE_STATUSES).optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  config: StepConfigSchema,
});

// ── Result ──
export const CreateResultSchema = z.object({
  phaseId: z.string().nullable().optional(),
  equipmentId: z.string().nullable().optional(),
  workloadName: z.string().trim().min(1).max(300),
  workloadConfig: z.string().max(5000).nullable().optional(),
  cycleDuration: z.string().max(100).nullable().optional(),
  totalCycles: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  completedCycles: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  result: z.enum(EVAL_TEST_RESULTS).optional(),
  value: z.string().max(200).nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
});
export const UpdateResultSchema = z.object({
  resultId: z.string().min(1),
  workloadName: z.string().trim().min(1).max(300).optional(),
  workloadConfig: z.string().max(5000).nullable().optional(),
  cycleDuration: z.string().max(100).nullable().optional(),
  result: z.enum(EVAL_TEST_RESULTS).optional(),
  value: z.string().max(200).nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  totalCycles: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  completedCycles: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
});

// ── Task ──
export const CreateTaskSchema = z.object({
  phaseId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(EVAL_TASK_PRIORITIES).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});
export const UpdateTaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(EVAL_TASK_STATUSES).optional(),
  priority: z.enum(EVAL_TASK_PRIORITIES).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});
