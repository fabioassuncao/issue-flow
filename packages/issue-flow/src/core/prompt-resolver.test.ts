import { describe, expect, it } from 'vitest';
import { applyPlaceholders } from './prompt-resolver.js';

describe('applyPlaceholders', () => {
  it('should replace __PRD_FILE__ placeholder', () => {
    const template = 'Read the PRD at __PRD_FILE__';
    const result = applyPlaceholders(template, {
      __PRD_FILE__: '/path/to/tasks.json',
    });
    expect(result).toBe('Read the PRD at /path/to/tasks.json');
  });

  it('should replace __PROGRESS_FILE__ placeholder', () => {
    const template = 'Write progress to __PROGRESS_FILE__';
    const result = applyPlaceholders(template, {
      __PROGRESS_FILE__: '/path/to/progress.txt',
    });
    expect(result).toBe('Write progress to /path/to/progress.txt');
  });

  it('should replace multiple placeholders', () => {
    const template = 'PRD: __PRD_FILE__, Progress: __PROGRESS_FILE__';
    const result = applyPlaceholders(template, {
      __PRD_FILE__: '/a/tasks.json',
      __PROGRESS_FILE__: '/b/progress.txt',
    });
    expect(result).toBe('PRD: /a/tasks.json, Progress: /b/progress.txt');
  });

  it('should replace all occurrences of the same placeholder', () => {
    const template = '__PRD_FILE__ and __PRD_FILE__ again';
    const result = applyPlaceholders(template, {
      __PRD_FILE__: '/path/tasks.json',
    });
    expect(result).toBe('/path/tasks.json and /path/tasks.json again');
  });

  it('should leave template unchanged if no matching placeholders', () => {
    const template = 'No placeholders here';
    const result = applyPlaceholders(template, {
      __PRD_FILE__: '/path',
    });
    expect(result).toBe('No placeholders here');
  });

  it('should handle empty template', () => {
    const result = applyPlaceholders('', { __PRD_FILE__: '/path' });
    expect(result).toBe('');
  });
});
