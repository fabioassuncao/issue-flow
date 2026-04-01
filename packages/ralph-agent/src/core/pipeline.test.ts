import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineManager, PIPELINE_PHASES } from './pipeline.js';
import type { TaskPlan } from '../types.js';

// Mock state-manager
vi.mock('./state-manager.js', () => ({
  loadTaskPlan: vi.fn(),
  saveTaskPlan: vi.fn(),
}));

function makePlan(overrides: Partial<TaskPlan['pipeline']> = {}): TaskPlan {
  return {
    project: 'test',
    issueNumber: 1,
    issueUrl: '',
    branchName: 'test-branch',
    description: '',
    issueStatus: 'pending',
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
      ...overrides,
    },
    userStories: [],
  };
}

describe('PipelineManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNextPhase', () => {
    it('returns analyze for a fresh plan (init has no state)', () => {
      const mgr = new PipelineManager(makePlan(), '/tmp/tasks.json');
      // init is always "complete" since it has no persisted state
      expect(mgr.getNextPhase()).toBe('analyze');
    });

    it('returns prd when analyze is complete', () => {
      const mgr = new PipelineManager(
        makePlan({ analyzeCompleted: true }),
        '/tmp/tasks.json',
      );
      expect(mgr.getNextPhase()).toBe('prd');
    });

    it('returns null when all phases are complete', () => {
      const mgr = new PipelineManager(
        makePlan({
          analyzeCompleted: true,
          prdCompleted: true,
          jsonCompleted: true,
          executionCompleted: true,
          reviewCompleted: true,
          prCreated: true,
        }),
        '/tmp/tasks.json',
      );
      expect(mgr.getNextPhase()).toBeNull();
    });

    it('skips to execute when first three phases are complete', () => {
      const mgr = new PipelineManager(
        makePlan({
          analyzeCompleted: true,
          prdCompleted: true,
          jsonCompleted: true,
        }),
        '/tmp/tasks.json',
      );
      expect(mgr.getNextPhase()).toBe('execute');
    });
  });

  describe('canResume', () => {
    it('can always resume from analyze (no prerequisites)', () => {
      const mgr = new PipelineManager(makePlan(), '/tmp/tasks.json');
      expect(mgr.canResume('analyze')).toBe(true);
    });

    it('cannot resume from prd if analyze is incomplete', () => {
      const mgr = new PipelineManager(makePlan(), '/tmp/tasks.json');
      expect(mgr.canResume('prd')).toBe(false);
    });

    it('can resume from prd if analyze is complete', () => {
      const mgr = new PipelineManager(
        makePlan({ analyzeCompleted: true }),
        '/tmp/tasks.json',
      );
      expect(mgr.canResume('prd')).toBe(true);
    });

    it('can resume from execute if all prior phases are complete', () => {
      const mgr = new PipelineManager(
        makePlan({
          analyzeCompleted: true,
          prdCompleted: true,
          jsonCompleted: true,
        }),
        '/tmp/tasks.json',
      );
      expect(mgr.canResume('execute')).toBe(true);
    });

    it('cannot resume from execute if plan is incomplete', () => {
      const mgr = new PipelineManager(
        makePlan({
          analyzeCompleted: true,
          prdCompleted: true,
        }),
        '/tmp/tasks.json',
      );
      expect(mgr.canResume('execute')).toBe(false);
    });
  });

  describe('markPhaseComplete', () => {
    it('persists the phase completion', async () => {
      const { saveTaskPlan } = await import('./state-manager.js');
      const mgr = new PipelineManager(makePlan(), '/tmp/tasks.json');

      await mgr.markPhaseComplete('analyze');

      expect(saveTaskPlan).toHaveBeenCalledWith(
        '/tmp/tasks.json',
        expect.objectContaining({
          pipeline: expect.objectContaining({ analyzeCompleted: true }),
        }),
      );
    });

    it('does nothing for init phase', async () => {
      const { saveTaskPlan } = await import('./state-manager.js');
      const mgr = new PipelineManager(makePlan(), '/tmp/tasks.json');

      await mgr.markPhaseComplete('init');

      expect(saveTaskPlan).not.toHaveBeenCalled();
    });
  });

  describe('isPhaseComplete', () => {
    it('init is always complete', () => {
      const mgr = new PipelineManager(makePlan(), '/tmp/tasks.json');
      expect(mgr.isPhaseComplete('init')).toBe(true);
    });

    it('analyze is incomplete by default', () => {
      const mgr = new PipelineManager(makePlan(), '/tmp/tasks.json');
      expect(mgr.isPhaseComplete('analyze')).toBe(false);
    });
  });

  it('defines 7 pipeline phases in order', () => {
    expect(PIPELINE_PHASES).toEqual([
      'init', 'analyze', 'prd', 'plan', 'execute', 'review', 'pr',
    ]);
  });
});
