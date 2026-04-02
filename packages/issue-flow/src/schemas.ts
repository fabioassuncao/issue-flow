import { z } from 'zod';

/**
 * Zod schemas for validating tasks.json structure and headless invocation outputs.
 */

export const userStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  priority: z.number().int().positive(),
  passes: z.boolean(),
  notes: z.string(),
});

export const pipelineStateSchema = z.object({
  analyzeCompleted: z.boolean(),
  prdCompleted: z.boolean(),
  jsonCompleted: z.boolean(),
  executionCompleted: z.boolean(),
  reviewCompleted: z.boolean(),
  prCreated: z.boolean(),
});

const lastErrorSchema = z.object({
  category: z.string(),
  message: z.string(),
  at: z.string(),
});

export const taskPlanSchema = z.object({
  project: z.string(),
  issueNumber: z.number().int().positive(),
  issueUrl: z.string(),
  branchName: z.string(),
  noBranch: z.boolean().optional().default(false),
  description: z.string(),
  issueStatus: z.enum(['pending', 'in_progress', 'completed']),
  completedAt: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  lastError: lastErrorSchema.nullable(),
  correctionCycle: z.number().int().min(0),
  maxCorrectionCycles: z.number().int().min(0),
  pipeline: pipelineStateSchema,
  userStories: z.array(userStorySchema),
});

export const headlessResultSchema = z.object({
  success: z.boolean(),
  result: z.string(),
  cost: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
    })
    .nullable(),
  error: z.string().nullable(),
});

export type ValidatedTaskPlan = z.infer<typeof taskPlanSchema>;
export type ValidatedHeadlessResult = z.infer<typeof headlessResultSchema>;
