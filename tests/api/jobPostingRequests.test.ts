// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  normalizeJobPostingRequestType,
  normalizeJobPostingStatus,
} from '../../api/_lib/jobPostingRequests';

describe('job posting request contract', () => {
  it('accepts only supported work request types', () => {
    expect(normalizeJobPostingRequestType('content')).toBe('content');
    expect(normalizeJobPostingRequestType('scraping')).toBe('scraping');
    expect(normalizeJobPostingRequestType('post')).toBeNull();
    expect(normalizeJobPostingRequestType(undefined)).toBeNull();
  });

  it('supports the completed status used after Scraping review', () => {
    expect(normalizeJobPostingStatus('completed')).toBe('completed');
    expect(normalizeJobPostingStatus('unknown')).toBeNull();
  });
});
