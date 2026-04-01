/**
 * Shared TypeScript interfaces for the Ralph Agent CLI.
 * These types mirror the tasks.json schema used by the issue-flow pipeline.
 */

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  notes: string;
}

export interface LastError {
  category: string;
  message: string;
  at: string;
}

export interface PipelineState {
  analyzeCompleted: boolean;
  prdCompleted: boolean;
  jsonCompleted: boolean;
  executionCompleted: boolean;
  reviewCompleted: boolean;
  prCreated: boolean;
}

export interface TaskPlan {
  project: string;
  issueNumber: number;
  issueUrl: string;
  branchName: string;
  description: string;
  issueStatus: 'pending' | 'in_progress' | 'completed';
  completedAt: string | null;
  lastAttemptAt: string | null;
  lastError: LastError | null;
  correctionCycle: number;
  maxCorrectionCycles: number;
  pipeline: PipelineState;
  userStories: UserStory[];
}

export interface RalphConfig {
  issueNumber: string | undefined;
  maxIterations: number | undefined;
  retryLimit: number;
  retryForever: boolean;
  backoffBaseSeconds: number;
  backoffMaxSeconds: number;
}

export interface ResolvedPaths {
  prdFile: string;
  progressFile: string;
  archiveDir: string;
  lastBranchFile: string;
  projectRoot: string;
}

export interface ClaudeResult {
  exitCode: number;
  output: string;
}
