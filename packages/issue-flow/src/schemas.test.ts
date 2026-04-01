import { describe, it, expect } from 'vitest';
import {
  taskPlanSchema,
  userStorySchema,
  pipelineStateSchema,
  headlessResultSchema,
} from './schemas.js';

function validTaskPlan() {
  return {
    project: 'test',
    issueNumber: 1,
    issueUrl: 'https://github.com/test/test/issues/1',
    branchName: 'issue/1-test',
    description: 'Test issue',
    issueStatus: 'pending' as const,
    completedAt: null,
    lastAttemptAt: null,
    lastError: null,
    correctionCycle: 0,
    maxCorrectionCycles: 3,
    pipeline: {
      analyzeCompleted: false,
      prdCompleted: false,
      jsonCompleted: false,
      executionCompleted: false,
      reviewCompleted: false,
      prCreated: false,
    },
    userStories: [
      {
        id: 'US-001',
        title: 'Test story',
        description: 'As a user...',
        acceptanceCriteria: ['Criterion 1'],
        priority: 1,
        passes: false,
        notes: '',
      },
    ],
  };
}

describe('taskPlanSchema', () => {
  it('validates a correct task plan', () => {
    const result = taskPlanSchema.safeParse(validTaskPlan());
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = taskPlanSchema.safeParse({ project: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid issueStatus', () => {
    const plan = { ...validTaskPlan(), issueStatus: 'unknown' };
    const result = taskPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it('accepts lastError when present', () => {
    const plan = {
      ...validTaskPlan(),
      lastError: { category: 'build', message: 'tsc failed', at: '2026-01-01T00:00:00Z' },
    };
    const result = taskPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it('rejects negative issueNumber', () => {
    const plan = { ...validTaskPlan(), issueNumber: -1 };
    const result = taskPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });
});

describe('userStorySchema', () => {
  it('validates a correct user story', () => {
    const result = userStorySchema.safeParse({
      id: 'US-001',
      title: 'Test',
      description: 'Desc',
      acceptanceCriteria: ['AC1'],
      priority: 1,
      passes: false,
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const result = userStorySchema.safeParse({
      title: 'Test',
      description: 'Desc',
      acceptanceCriteria: [],
      priority: 1,
      passes: false,
      notes: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('pipelineStateSchema', () => {
  it('validates correct pipeline state', () => {
    const result = pipelineStateSchema.safeParse({
      analyzeCompleted: true,
      prdCompleted: false,
      jsonCompleted: false,
      executionCompleted: false,
      reviewCompleted: false,
      prCreated: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-boolean values', () => {
    const result = pipelineStateSchema.safeParse({
      analyzeCompleted: 'yes',
      prdCompleted: false,
      jsonCompleted: false,
      executionCompleted: false,
      reviewCompleted: false,
      prCreated: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('headlessResultSchema', () => {
  it('validates a success result', () => {
    const result = headlessResultSchema.safeParse({
      success: true,
      result: 'output text',
      cost: { inputTokens: 100, outputTokens: 50 },
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it('validates an error result', () => {
    const result = headlessResultSchema.safeParse({
      success: false,
      result: '',
      cost: null,
      error: 'something went wrong',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing fields', () => {
    const result = headlessResultSchema.safeParse({ success: true });
    expect(result.success).toBe(false);
  });
});
